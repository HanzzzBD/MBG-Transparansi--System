const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const {
  buildFileUrl,
  createStoredName,
  getFileExtensionFromMimeType,
  uploadBufferToStorage
} = require("../../utils/storage");

const prisma = getPrismaClient();

const uploadFile = async ({ file, user, ipAddress }) => {
  if (!file) {
    throw new AppError("A file is required.", 400, "FILE_REQUIRED");
  }

  const extension = getFileExtensionFromMimeType(file.mimetype);
  const storedName = createStoredName({
    category: "uploads",
    extension
  });
  const fileUrl = buildFileUrl(storedName);

  const createdFile = await prisma.$transaction(async (tx) => {
    const created = await tx.file.create({
      data: {
        originalName: file.originalname,
        storedName,
        fileUrl,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedBy: user.userId,
        status: "processing"
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "INSERT",
      tableName: "files",
      recordId: created.id,
      newData: created,
      ipAddress
    });

    return created;
  });

  try {
    const uploaded = await uploadBufferToStorage({
      storedName,
      buffer: file.buffer,
      mimeType: file.mimetype
    });

    const readyFile = await prisma.file.update({
      where: {
        id: createdFile.id
      },
      data: {
        fileUrl: uploaded.fileUrl,
        status: "ready"
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    return {
      data: readyFile
    };
  } catch (error) {
    await prisma.file.update({
      where: {
        id: createdFile.id
      },
      data: {
        status: "failed"
      }
    });

    throw new AppError("File upload failed.", 500, "FILE_UPLOAD_FAILED", {
      reason: error.message
    });
  }
};

module.exports = {
  uploadFile
};
