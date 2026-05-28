const multer = require("multer");

const AppError = require("../../utils/appError");

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const detectImageMimeType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.slice(0, 4).toString("ascii") === "RIFF" &&
    buffer.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
};

const validateImageSignature = (file) => {
  const detectedMimeType = detectImageMimeType(file?.buffer);

  if (!detectedMimeType || detectedMimeType !== file?.mimetype) {
    throw new AppError(
      "Uploaded image content does not match an allowed image format.",
      400,
      "FILE_CONTENT_NOT_ALLOWED"
    );
  }
};

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new AppError("Only JPEG, PNG, and WEBP images are allowed.", 400, "FILE_TYPE_NOT_ALLOWED"));
      return;
    }

    callback(null, true);
  }
});

const uploadSingleImage = (fieldName) => (req, res, next) => {
  multerUpload.single(fieldName)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new AppError("File size must not exceed 5MB.", 400, "FILE_TOO_LARGE"));
      return;
    }

    next(error);
  });
};

module.exports = {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  detectImageMimeType,
  validateImageSignature,
  uploadSingleImage
};
