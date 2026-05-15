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
  listSystemConfigsSchema,
  listUsersSchema,
  overrideDistributionSchema,
  updatePriceThresholdSchema,
  updateSystemConfigSchema,
  updateUserSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/users", validateRequest(listUsersSchema), controller.listUsers);
router.post("/users", validateRequest(createUserSchema), controller.createUser);
router.put("/users/:id", validateRequest(updateUserSchema), controller.updateUser);
router.delete("/users/:id", validateRequest(adminUserIdParamsSchema), controller.deleteUser);

router.get("/audit-logs", validateRequest(listAuditLogsSchema), controller.listAuditLogs);
router.get("/anomaly-logs", validateRequest(listAnomalyLogsSchema), controller.listAnomalyLogs);
router.put(
  "/anomaly-logs/:id/resolve",
  validateRequest(anomalyLogIdParamsSchema),
  controller.resolveAnomalyLog
);

router.post(
  "/distributions/:id/lock",
  validateRequest(distributionLockParamsSchema),
  controller.lockDistribution
);
router.post(
  "/distributions/:id/unlock",
  validateRequest(distributionLockParamsSchema),
  controller.unlockDistribution
);
router.put(
  "/distributions/:id/override",
  validateRequest(overrideDistributionSchema),
  controller.overrideDistribution
);

router.get("/price-thresholds", validateRequest(listPriceThresholdsSchema), controller.listPriceThresholds);
router.put(
  "/price-thresholds/:province",
  validateRequest(updatePriceThresholdSchema),
  controller.updatePriceThreshold
);

router.get("/system-configs", validateRequest(listSystemConfigsSchema), controller.listSystemConfigs);
router.put(
  "/system-configs/:key",
  validateRequest(updateSystemConfigSchema),
  controller.updateSystemConfig
);

module.exports = router;
