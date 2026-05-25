const express = require("express");
const multer = require("multer");

const controller = require("./controller");
const {
  importStagedSchoolsSchema,
  linkStagedSchoolSchema,
  latestSyncLogSchema,
  listStagedSchoolsSchema,
  promoteStagedSchoolSchema,
  regionRecapSchema,
  schoolProgressSchema,
  stagedSchoolIdParamsSchema,
  syncSchoolProgressSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");
const { env } = require("../../config/env");

const router = express.Router();
const importMaxFileSizeBytes = env.DAPODIK_IMPORT_MAX_FILE_SIZE_MB * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: importMaxFileSizeBytes
  }
});

router.use(authenticate);

router.get(
  "/regions",
  authorize("pemerintah", "admin"),
  validateRequest(regionRecapSchema),
  controller.getRegionRecap
);
router.get(
  "/schools",
  authorize("pemerintah", "admin"),
  validateRequest(schoolProgressSchema),
  controller.getSchoolProgress
);
router.post(
  "/sync-schools",
  authorize("admin"),
  validateRequest(syncSchoolProgressSchema),
  controller.syncSchoolProgress
);
router.post(
  "/import-schools",
  authorize("admin"),
  upload.single("file"),
  validateRequest(importStagedSchoolsSchema),
  controller.importStagedSchools
);
router.get(
  "/sync-logs/latest",
  authorize("admin"),
  validateRequest(latestSyncLogSchema),
  controller.getLatestSyncLog
);
router.get(
  "/staged-schools",
  authorize("admin"),
  validateRequest(listStagedSchoolsSchema),
  controller.listStagedSchools
);
router.get(
  "/staged-schools/:id",
  authorize("admin"),
  validateRequest(stagedSchoolIdParamsSchema),
  controller.getStagedSchoolDetail
);
router.post(
  "/staged-schools/:id/promote",
  authorize("admin"),
  validateRequest(promoteStagedSchoolSchema),
  controller.promoteStagedSchool
);
router.post(
  "/staged-schools/:id/link",
  authorize("admin"),
  validateRequest(linkStagedSchoolSchema),
  controller.linkStagedSchool
);

module.exports = router;
