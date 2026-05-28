const { requirePermission } = require("./permissions");

const requirePermissionWhen = (predicate, permissionKey) => (req, res, next) => {
  if (!predicate(req)) {
    return next();
  }

  return requirePermission(permissionKey)(req, res, next);
};

const requirePermissionForDistributionUpdate = (req, res, next) => {
  const permissionKey = ["delivered", "sent"].includes(req.body?.status)
    ? "distribution.mark_sent"
    : "distribution.correct";

  return requirePermission(permissionKey)(req, res, next);
};

const requirePermissionForUserStatus = (req, res, next) => {
  const permissionKey = req.body?.isActive === true ? "user.unlock" : "user.lock";
  return requirePermission(permissionKey)(req, res, next);
};

module.exports = {
  requirePermissionForDistributionUpdate,
  requirePermissionForUserStatus,
  requirePermissionWhen
};
