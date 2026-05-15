const AppError = require("../utils/appError");
const { clientOrigins } = require("./env");

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin || clientOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new AppError("Origin is not allowed by CORS.", 403, "CORS_ORIGIN_FORBIDDEN")
    );
  }
};

module.exports = {
  corsOptions
};
