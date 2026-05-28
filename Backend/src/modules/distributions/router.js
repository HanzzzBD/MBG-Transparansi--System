const express = require("express");

const controller = require("./controller");
const {
  createDistributionSchema,
  distributionIdParamsSchema,
  distributionLockSchema,
  distributionOverrideSchema,
  listDistributionsSchema,
  updateDistributionSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const {
  requirePermissionForDistributionUpdate,
  requirePermissionWhen
} = require("../../middlewares/permissionConditions");
const { requirePermission } = require("../../middlewares/permissions");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize("sppg", "sekolah", "pemerintah", "admin"),
  requirePermission("distribution.view"),
  validateRequest(listDistributionsSchema),
  controller.listDistributions
);
router.get(
  "/lock-summary",
  authorize("admin"),
  requirePermission("admin.lock_unlock.manage"),
  controller.getLockSummary
);
router.get(
  "/:id",
  authorize("sppg", "sekolah", "pemerintah", "admin"),
  requirePermission("distribution.view"),
  validateRequest(distributionIdParamsSchema),
  controller.getDistributionDetail
);
router.post(
  "/",
  authorize("sppg", "admin"),
  validateRequest(createDistributionSchema),
  requirePermission("distribution.create"),
  requirePermissionWhen((req) => ["delivered", "sent"].includes(req.body?.status), "distribution.mark_sent"),
  controller.createDistribution
);
router.patch(
  "/:id/lock",
  authorize("admin"),
  validateRequest(distributionLockSchema),
  requirePermission("admin.lock_unlock.manage"),
  controller.lockDistribution
);
router.patch(
  "/:id/unlock",
  authorize("admin"),
  validateRequest(distributionLockSchema),
  requirePermission("admin.lock_unlock.manage"),
  controller.unlockDistribution
);
router.patch(
  "/:id/override",
  authorize("admin"),
  validateRequest(distributionOverrideSchema),
  requirePermission("admin.override.manage"),
  requirePermissionWhen((req) => req.body?.changes?.pricePerPortion !== undefined, "daily_menu.price.override"),
  controller.overrideDistribution
);
router.put(
  "/:id",
  authorize("sppg", "admin"),
  validateRequest(updateDistributionSchema),
  requirePermissionForDistributionUpdate,
  controller.updateDistribution
);
router.post(
  "/:id/mark-sent",
  authorize("sppg", "admin"),
  validateRequest(distributionIdParamsSchema),
  requirePermission("distribution.mark_sent"),
  controller.markDistributionSent
);

module.exports = router;
