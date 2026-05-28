const express = require("express");

const controller = require("./controller");
const {
  adminUserIdParamsSchema,
  anomalyLogIdParamsSchema,
  createUserSchema,
  distributionLockParamsSchema,
  listAnomalyLogsSchema,
  listAuditLogsSchema,
  listPriceThresholdsSchema,
  listRolesSchema,
  listSystemConfigsSchema,
  listUsersSchema,
  overrideDistributionSchema,
  updatePriceThresholdSchema,
  updateSystemConfigSchema,
  updateUserStatusSchema,
  updateUserSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { requirePermissionForUserStatus } = require("../../middlewares/permissionConditions");
const { requirePermission } = require("../../middlewares/permissions");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/roles", requirePermission("admin.users.manage"), validateRequest(listRolesSchema), controller.listRoles);
router.get("/users", requirePermission("admin.users.manage"), validateRequest(listUsersSchema), controller.listUsers);
router.post("/users", requirePermission("admin.users.manage"), validateRequest(createUserSchema), controller.createUser);
router.patch(
  "/users/:id/status",
  requirePermission("admin.users.manage"),
  validateRequest(updateUserStatusSchema),
  requirePermissionForUserStatus,
  controller.updateUserStatus
);
router.put("/users/:id", requirePermission("admin.users.manage"), validateRequest(updateUserSchema), controller.updateUser);
router.patch("/users/:id", requirePermission("admin.users.manage"), validateRequest(updateUserSchema), controller.updateUser);
router.delete("/users/:id", requirePermission("admin.users.manage"), validateRequest(adminUserIdParamsSchema), controller.deleteUser);

router.get("/audit-logs", requirePermission("audit.view"), validateRequest(listAuditLogsSchema), controller.listAuditLogs);
router.get("/anomaly-logs", validateRequest(listAnomalyLogsSchema), controller.listAnomalyLogs);
router.put(
  "/anomaly-logs/:id/resolve",
  validateRequest(anomalyLogIdParamsSchema),
  controller.resolveAnomalyLog
);

router.post(
  "/distributions/:id/lock",
  requirePermission("admin.lock_unlock.manage"),
  validateRequest(distributionLockParamsSchema),
  controller.lockDistribution
);
router.post(
  "/distributions/:id/unlock",
  requirePermission("admin.lock_unlock.manage"),
  validateRequest(distributionLockParamsSchema),
  controller.unlockDistribution
);
router.put(
  "/distributions/:id/override",
  requirePermission("admin.override.manage"),
  validateRequest(overrideDistributionSchema),
  controller.overrideDistribution
);

router.get("/price-thresholds", validateRequest(listPriceThresholdsSchema), controller.listPriceThresholds);
router.put(
  "/price-thresholds/:province",
  requirePermission("daily_menu.price.validate"),
  validateRequest(updatePriceThresholdSchema),
  controller.updatePriceThreshold
);

router.get("/system-configs", requirePermission("admin.settings.manage"), validateRequest(listSystemConfigsSchema), controller.listSystemConfigs);
router.put(
  "/system-configs/:key",
  requirePermission("admin.settings.manage"),
  validateRequest(updateSystemConfigSchema),
  controller.updateSystemConfig
);

module.exports = router;
