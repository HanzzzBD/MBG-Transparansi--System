const express = require("express");

const controller = require("./controller");
const {
  createSppgSchema,
  adminAssignSppgSchoolsSchema,
  adminSppgSchoolsSchema,
  adminUnassignSppgSchoolSchema,
  assignMySchoolsSchema,
  listDeletedSppgSchema,
  listMyDapodikSchoolsSchema,
  listSppgSchema,
  listMySchoolsSchema,
  mapMarkersSchema,
  sppgIdParamsSchema,
  unassignMySchoolSchema,
  updateMySppgProfileSchema,
  updateSppgStatusSchema,
  updateSppgSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { requirePermission } = require("../../middlewares/permissions");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("admin", "pemerintah", "sppg", "sekolah"),
  validateRequest(listSppgSchema),
  controller.listSppg
);
router.get(
  "/deleted",
  authenticate,
  authorize("admin"),
  validateRequest(listDeletedSppgSchema),
  controller.listDeletedSppg
);
router.get(
  "/map-markers",
  authenticate,
  authorize("admin", "pemerintah", "sppg", "sekolah"),
  requirePermission("sppg.status.read"),
  validateRequest(mapMarkersSchema),
  controller.listMapMarkers
);
router.get(
  "/me/dapodik-schools",
  authenticate,
  authorize("sppg"),
  requirePermission("sppg.school_channel.view"),
  validateRequest(listMyDapodikSchoolsSchema),
  controller.listMyDapodikSchools
);
router.post(
  "/me/schools/assign",
  authenticate,
  authorize("sppg"),
  requirePermission("sppg.school_channel.manage"),
  validateRequest(assignMySchoolsSchema),
  controller.assignMySchools
);
router.patch(
  "/me/schools/:assignmentId/unassign",
  authenticate,
  authorize("sppg"),
  requirePermission("sppg.school_channel.manage"),
  validateRequest(unassignMySchoolSchema),
  controller.unassignMySchool
);
router.get(
  "/me/schools",
  authenticate,
  authorize("sppg"),
  requirePermission("sppg.school_channel.view"),
  validateRequest(listMySchoolsSchema),
  controller.listMySchools
);
router.patch(
  "/me/profile",
  authenticate,
  authorize("sppg"),
  requirePermission("account.update"),
  validateRequest(updateMySppgProfileSchema),
  controller.updateMySppgProfile
);
router.get(
  "/:id/schools",
  authenticate,
  authorize("admin"),
  validateRequest(adminSppgSchoolsSchema),
  controller.listAdminSppgSchools
);
router.post(
  "/:id/schools/assign",
  authenticate,
  authorize("admin"),
  validateRequest(adminAssignSppgSchoolsSchema),
  controller.assignAdminSppgSchools
);
router.patch(
  "/:id/schools/:assignmentId/unassign",
  authenticate,
  authorize("admin"),
  validateRequest(adminUnassignSppgSchoolSchema),
  controller.unassignAdminSppgSchool
);
router.get(
  "/:id/detail",
  authenticate,
  authorize("admin", "pemerintah", "sppg", "sekolah"),
  requirePermission("sppg.status.read"),
  validateRequest(sppgIdParamsSchema),
  controller.getSppgOperationalDetail
);
router.get(
  "/:id",
  authenticate,
  authorize("sppg", "pemerintah", "admin"),
  requirePermission("sppg.status.read"),
  validateRequest(sppgIdParamsSchema),
  controller.getSppgDetail
);
router.post("/", authenticate, authorize("admin"), validateRequest(createSppgSchema), controller.createSppg);
router.patch(
  "/:id/status",
  authenticate,
  authorize("admin"),
  requirePermission("sppg.status.update"),
  validateRequest(updateSppgStatusSchema),
  controller.updateSppgStatus
);
router.put(
  "/:id",
  authenticate,
  authorize("admin"),
  requirePermission("sppg.status.update"),
  validateRequest(updateSppgSchema),
  controller.updateSppg
);
router.patch("/:id/restore", authenticate, authorize("admin"), validateRequest(sppgIdParamsSchema), controller.restoreSppg);
router.delete("/:id", authenticate, authorize("admin"), validateRequest(sppgIdParamsSchema), controller.deleteSppg);

module.exports = router;
