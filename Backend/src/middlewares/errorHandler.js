const AppError = require("../utils/appError");

const notFoundHandler = (req, _res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} was not found.`, 404, "ROUTE_NOT_FOUND"));
};

const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let code = err.code || "INTERNAL_SERVER_ERROR";
  let message = err.message || "Internal server error.";
  let details = err.details;

  if (err.name === "ZodError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = "Request validation failed.";
    details = err.flatten ? err.flatten() : err.issues;
  }

  if (err.name === "MulterError") {
    statusCode = 400;
    code = "FILE_UPLOAD_ERROR";
    message = err.message || "File upload failed.";
  }

  if (err.code === "P2002") {
    statusCode = 409;
    code = "RESOURCE_CONFLICT";
    message = "A resource with the same unique value already exists.";
  }

  const payload = {
    status: "error",
    message,
    code
  };

  if (process.env.NODE_ENV !== "production" && details) {
    payload.details = details;
  }

  if (process.env.NODE_ENV !== "production" && !details && !(err instanceof AppError) && err.stack) {
    payload.details = err.stack;
  }

  res.status(statusCode).json(payload);
};

module.exports = {
  errorHandler,
  notFoundHandler
};
