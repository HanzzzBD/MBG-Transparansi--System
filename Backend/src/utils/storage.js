const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");

const AppError = require("./appError");
const { storageConfig } = require("../config/storage");

let s3ClientInstance;

const MIME_EXTENSION_MAP = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx"
};

const normalizeStoredName = (storedName) => storedName.replace(/\\/g, "/").replace(/^\/+/, "");

const getFileExtensionFromMimeType = (mimeType, fallback = "") => MIME_EXTENSION_MAP[mimeType] || fallback;

const sanitizeExtension = (extension) => {
  if (!extension) {
    return "";
  }

  return extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
};

const createStoredName = ({ category, extension }) => {
  const safeCategory = category.trim().replace(/^\/+|\/+$/g, "");
  return path.posix.join(safeCategory, `${crypto.randomUUID()}${sanitizeExtension(extension)}`);
};

const getLocalAbsolutePath = (storedName) =>
  path.join(storageConfig.localStorageRoot, ...normalizeStoredName(storedName).split("/"));

const ensureLocalDirectory = async (storedName) => {
  const absolutePath = getLocalAbsolutePath(storedName);
  await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
  return absolutePath;
};

const buildFileUrl = (storedName) => {
  const normalizedStoredName = normalizeStoredName(storedName);

  if (storageConfig.provider === "local") {
    return `/storage/${normalizedStoredName}`;
  }

  if (storageConfig.r2.publicUrl) {
    return `${storageConfig.r2.publicUrl.replace(/\/+$/, "")}/${normalizedStoredName}`;
  }

  return normalizedStoredName;
};

const getS3Client = () => {
  if (!s3ClientInstance) {
    const { S3Client } = require("@aws-sdk/client-s3");

    if (
      !storageConfig.r2.accountId ||
      !storageConfig.r2.accessKeyId ||
      !storageConfig.r2.secretAccessKey ||
      !storageConfig.r2.bucketName
    ) {
      throw new AppError("R2 storage configuration is incomplete.", 500, "STORAGE_CONFIG_INVALID");
    }

    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint: `https://${storageConfig.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: storageConfig.r2.accessKeyId,
        secretAccessKey: storageConfig.r2.secretAccessKey
      }
    });
  }

  return s3ClientInstance;
};

const uploadBufferToStorage = async ({ storedName, buffer, mimeType }) => {
  const normalizedStoredName = normalizeStoredName(storedName);

  if (storageConfig.provider === "local") {
    const absolutePath = await ensureLocalDirectory(normalizedStoredName);
    await fs.promises.writeFile(absolutePath, buffer);
    return {
      storedName: normalizedStoredName,
      fileUrl: buildFileUrl(normalizedStoredName)
    };
  }

  const { PutObjectCommand } = require("@aws-sdk/client-s3");

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: storageConfig.r2.bucketName,
      Key: normalizedStoredName,
      Body: buffer,
      ContentType: mimeType
    })
  );

  return {
    storedName: normalizedStoredName,
    fileUrl: buildFileUrl(normalizedStoredName)
  };
};

const deleteStoredObject = async (storedName) => {
  const normalizedStoredName = normalizeStoredName(storedName);

  if (storageConfig.provider === "local") {
    const absolutePath = getLocalAbsolutePath(normalizedStoredName);
    await fs.promises.rm(absolutePath, { force: true });
    return;
  }

  const { DeleteObjectCommand } = require("@aws-sdk/client-s3");

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: storageConfig.r2.bucketName,
      Key: normalizedStoredName
    })
  );
};

const streamStoredObjectToResponse = async ({ res, storedName, downloadName, mimeType }) => {
  const normalizedStoredName = normalizeStoredName(storedName);
  const safeDownloadName = downloadName || path.basename(normalizedStoredName);

  if (storageConfig.provider === "local") {
    const absolutePath = getLocalAbsolutePath(normalizedStoredName);

    try {
      await fs.promises.access(absolutePath, fs.constants.R_OK);
    } catch (_error) {
      throw new AppError("Requested file was not found in storage.", 404, "FILE_NOT_FOUND");
    }

    res.setHeader("Content-Type", mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeDownloadName}"`);

    const fileStream = fs.createReadStream(absolutePath);
    await pipeline(fileStream, res);
    return;
  }

  const { GetObjectCommand } = require("@aws-sdk/client-s3");
  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: storageConfig.r2.bucketName,
      Key: normalizedStoredName
    })
  );

  if (!response.Body) {
    throw new AppError("Requested file was not found in storage.", 404, "FILE_NOT_FOUND");
  }

  res.setHeader("Content-Type", mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${safeDownloadName}"`);

  await pipeline(response.Body, res);
};

module.exports = {
  buildFileUrl,
  createStoredName,
  deleteStoredObject,
  getFileExtensionFromMimeType,
  getLocalAbsolutePath,
  normalizeStoredName,
  streamStoredObjectToResponse,
  uploadBufferToStorage
};
