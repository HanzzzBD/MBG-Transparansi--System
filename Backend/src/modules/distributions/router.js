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
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize("sppg", "sekolah", "pemerintah", "admin"),
  validateRequest(listDistributionsSchema),
  controller.listDistributions
);
router.get(
  "/lock-summary",
  authorize("admin"),
  controller.getLockSummary
);
router.get(
  "/:id",
  authorize("sppg", "sekolah", "pemerintah", "admin"),
  validateRequest(distributionIdParamsSchema),
  controller.getDistributionDetail
);
router.post(
  "/",
  authorize("sppg", "admin"),
  validateRequest(createDistributionSchema),
  controller.createDistribution
);
router.patch(
  "/:id/lock",
  authorize("admin"),
  validateRequest(distributionLockSchema),
  controller.lockDistribution
);
router.patch(
  "/:id/unlock",
  authorize("admin"),
  validateRequest(distributionLockSchema),
  controller.unlockDistribution
);
router.patch(
  "/:id/override",
  authorize("admin"),
  validateRequest(distributionOverrideSchema),
  controller.overrideDistribution
);
router.put(
  "/:id",
  authorize("sppg", "admin"),
  validateRequest(updateDistributionSchema),
  controller.updateDistribution
);

module.exports = router;
