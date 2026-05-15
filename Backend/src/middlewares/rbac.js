const AppError = require("../utils/appError");

const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(new AppError("Authentication is required.", 401, "AUTH_REQUIRED"));
  }

  if (roles.length > 0 && !roles.includes(req.user.role)) {
    return next(
      new AppError("You do not have permission to access this resource.", 403, "FORBIDDEN")
    );
  }

  return next();
};

module.exports = {
  authorize
};
