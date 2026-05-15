const express = require("express");

const controller = require("./controller");
const {
  createPublicReportSchema,
  createSchoolReportSchema,
  listPublicReportsSchema,
  listSchoolReportsSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { publicReportLimiter } = require("../../middlewares/rateLimiter");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.post(
  "/public-reports",
  publicReportLimiter,
  validateRequest(createPublicReportSchema),
  controller.createPublicReport
);
router.get(
  "/public-reports",
  authenticate,
  authorize("pemerintah", "admin"),
  validateRequest(listPublicReportsSchema),
  controller.listPublicReports
);
router.post(
  "/school-reports",
  authenticate,
  authorize("sekolah", "admin"),
  validateRequest(createSchoolReportSchema),
  controller.createSchoolReport
);
router.get(
  "/school-reports",
  authenticate,
  authorize("sekolah", "pemerintah", "admin"),
  validateRequest(listSchoolReportsSchema),
  controller.listSchoolReports
);

module.exports = router;
