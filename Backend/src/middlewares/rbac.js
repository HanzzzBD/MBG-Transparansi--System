const AppError = require("../utils/appError");

const ROLE_ALIASES = {};

const expandRoles = (roles) => {
  const expanded = new Set();

  for (const role of roles) {
    expanded.add(role);
    for (const alias of ROLE_ALIASES[role] || []) {
      expanded.add(alias);
    }
  }

  return expanded;
};

const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(new AppError("Authentication is required.", 401, "AUTH_REQUIRED"));
  }

  if (roles.length > 0 && !expandRoles(roles).has(req.user.role)) {
    return next(
      new AppError("You do not have permission to access this resource.", 403, "FORBIDDEN")
    );
  }

  return next();
};

module.exports = {
  authorize
};
