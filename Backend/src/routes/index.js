const express = require("express");

const adminRoutes = require("../modules/admin/router");
const analyticsRoutes = require("../modules/analytics/router");
const authRoutes = require("../modules/auth/router");
const compatRoutes = require("../modules/compat/router");
const dapodikRoutes = require("../modules/dapodik/router");
const dashboardRoutes = require("../modules/dashboard/router");
const distributionRoutes = require("../modules/distributions/router");
const exportRoutes = require("../modules/exports/router");
const fileRoutes = require("../modules/files/router");
const foodPriceRoutes = require("../modules/foodPrices/router");
const issueRoutes = require("../modules/issues/router");
const menuRoutes = require("../modules/menus/router");
const monitoringRoutes = require("../modules/monitoring/router");
const notificationRoutes = require("../modules/notifications/router");
const priceThresholdRoutes = require("../modules/priceThresholds/router");
const productionBatchRoutes = require("../modules/productionBatches/router");
const proofRoutes = require("../modules/proofs/router");
const publicRoutes = require("../modules/public/router");
const reportRoutes = require("../modules/reports/router");
const auditLogRoutes = require("../modules/auditLogs/router");
const searchRoutes = require("../modules/search/router");
const schoolRoutes = require("../modules/schools/router");
const sppgRoutes = require("../modules/sppg/router");
const userRoutes = require("../modules/users/router");
const validationRoutes = require("../modules/validations/router");

const router = express.Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    status: "success",
    data: {
      message: "MBG Transparency System API is running."
    }
  });
});

router.get("/health", (_req, res) => {
  res.status(200).json({
    status: "success",
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  });
});

router.use("/admin", adminRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/audit-logs", auditLogRoutes);
router.use("/auth", authRoutes);
router.use("/dapodik", dapodikRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/sppg", sppgRoutes);
router.use("/users", userRoutes);
router.use("/schools", schoolRoutes);
router.use("/distributions", distributionRoutes);
router.use("/exports", exportRoutes);
router.use("/files", fileRoutes);
router.use("/food-prices", foodPriceRoutes);
router.use("/notifications", notificationRoutes);
router.use("/price-thresholds", priceThresholdRoutes);
router.use("/public", publicRoutes);
router.use("/search", searchRoutes);
router.use(productionBatchRoutes);
router.use("/validations", validationRoutes);
router.use("/menus", menuRoutes);
router.use("/monitoring", monitoringRoutes);
router.use("/issues", issueRoutes);
router.use(proofRoutes);
router.use(reportRoutes);
router.use(compatRoutes);

module.exports = router;
