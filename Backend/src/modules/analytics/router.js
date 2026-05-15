const express = require("express");

const controller = require("./controller");
const {
  anomalySchema,
  budgetSchema,
  byProvinceSchema,
  distributionsSchema,
  successRateSchema,
  summarySchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.get("/summary", validateRequest(summarySchema), controller.getSummary);
router.get(
  "/distributions",
  authenticate,
  authorize("pemerintah", "admin"),
  validateRequest(distributionsSchema),
  controller.getDistributionTrend
);
router.get(
  "/success-rate",
  authenticate,
  authorize("pemerintah", "admin"),
  validateRequest(successRateSchema),
  controller.getSuccessRate
);
router.get(
  "/budget",
  authenticate,
  authorize("pemerintah", "admin"),
  validateRequest(budgetSchema),
  controller.getBudget
);
router.get(
  "/by-province",
  authenticate,
  authorize("pemerintah", "admin"),
  validateRequest(byProvinceSchema),
  controller.getByProvince
);
router.get(
  "/anomaly",
  authenticate,
  authorize("pemerintah", "admin"),
  validateRequest(anomalySchema),
  controller.getAnomaly
);

module.exports = router;
