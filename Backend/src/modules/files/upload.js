const multer = require("multer");

const AppError = require("../../utils/appError");

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  uploadSingleImage
};
