const AppError = require("../utils/appError");
const permissionService = require("../modules/permissions/service");

const permissionDeniedError = (permissionKey) =>
  new AppError("Anda tidak memiliki akses untuk melakukan aksi ini.", 403, "PERMISSION_DENIED", {
    permissionKey
  });

const logPermissionMiddlewareIssue = (message, details = {}) => {
  console.warn("[permission-middleware]", message, details);
};

const requirePermission = (permissionKey) => async (req, _res, next) => {
  try {
    if (!req.user?.userId && !req.user?.id) {
      return next(new AppError("Authentication is required.", 401, "AUTH_REQUIRED"));
    }

    const userId = req.user.userId || req.user.id;
    const allowed = await permissionService.hasPermission(userId, permissionKey);

    if (!allowed) {
      return next(permissionDeniedError(permissionKey));
    }

    return next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    logPermissionMiddlewareIssue("Unexpected permission check failure.", {
      permissionKey,
      userId: req.user?.userId || req.user?.id,
      error: error.message
    });

    return next(permissionDeniedError(permissionKey));
  }
};

// Usage examples for sensitive routes:
// router.get("/permissions", authenticate, authorize("admin"), requirePermission("permission.view"), controller.list);
// router.post("/permissions/grants", authenticate, authorize("admin"), requirePermission("permission.grant"), controller.grant);
// router.post("/menus/:id/validate-price", authenticate, authorize("sppg"), requirePermission("daily_menu.price.validate"), controller.validatePrice);
// router.patch("/distributions/:id/mark-sent", authenticate, authorize("sppg"), requirePermission("distribution.mark_sent"), controller.markSent);

module.exports = {
  requirePermission
};
