const express = require("express");

const controller = require("./controller");
const { dashboardSummarySchema } = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.get(
  "/admin-summary",
  authenticate,
  authorize("admin"),
  validateRequest(dashboardSummarySchema),
  controller.getAdminSummary
);

router.get(
  "/gov-summary",
  authenticate,
  authorize("pemerintah"),
  validateRequest(dashboardSummarySchema),
  controller.getGovSummary
);

router.get(
  "/sppg-summary",
  authenticate,
  authorize("sppg"),
  validateRequest(dashboardSummarySchema),
  controller.getSppgSummary
);

router.get(
  "/school-summary",
  authenticate,
  authorize("sekolah"),
  validateRequest(dashboardSummarySchema),
  controller.getSchoolSummary
);

module.exports = router;
