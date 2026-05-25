const express = require("express");

const controller = require("./controller");
const {
  anomalySchema,
  budgetSchema,
  byProvinceSchema,
  distributionsSchema,
  priceAnomaliesSchema,
  publicReportsAnalyticsSchema,
  successRateSchema,
  summarySchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.get("/summary", validateRequest(summarySchema), controller.getSummary);
router.get(
  "/public-reports-summary",
  authenticate,
  authorize("pemerintah", "admin"),
  validateRequest(publicReportsAnalyticsSchema),
  controller.getPublicReportsSummary
);
router.get(
  "/public-reports-trend",
  authenticate,
  authorize("pemerintah", "admin"),
  validateRequest(publicReportsAnalyticsSchema),
  controller.getPublicReportsTrend
);
router.get(
  "/public-reports-top-regions",
  authenticate,
  authorize("pemerintah", "admin"),
  validateRequest(publicReportsAnalyticsSchema),
  controller.getPublicReportsTopRegions
);
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
  "/budget-summary",
  authenticate,
  authorize("pemerintah", "admin"),
  validateRequest(budgetSchema),
  controller.getBudgetSummary
);
router.get(
  "/price-per-province",
  authenticate,
  authorize("pemerintah", "admin"),
  validateRequest(budgetSchema),
  controller.getPricePerProvince
);
router.get(
  "/price-anomalies",
  authenticate,
  authorize("pemerintah", "admin"),
  validateRequest(priceAnomaliesSchema),
  controller.getPriceAnomalies
);
router.get(
  "/costing",
  authenticate,
  authorize("pemerintah", "admin"),
  validateRequest(budgetSchema),
  controller.getCostingAnalytics
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
