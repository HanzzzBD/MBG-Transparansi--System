const express = require("express");

const controller = require("./controller");
const {
  createSppgSchema,
  listDeletedSppgSchema,
  listSppgSchema,
  listMySchoolsSchema,
  mapMarkersSchema,
  sppgIdParamsSchema,
  updateSppgSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.get("/", validateRequest(listSppgSchema), controller.listSppg);
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
  validateRequest(mapMarkersSchema),
  controller.listMapMarkers
);
router.get(
  "/me/schools",
  authenticate,
  authorize("sppg"),
  validateRequest(listMySchoolsSchema),
  controller.listMySchools
);
router.get(
  "/:id/detail",
  authenticate,
  authorize("admin", "pemerintah", "sppg", "sekolah"),
  validateRequest(sppgIdParamsSchema),
  controller.getSppgOperationalDetail
);
router.get(
  "/:id",
  authenticate,
  authorize("sppg", "pemerintah", "admin"),
  validateRequest(sppgIdParamsSchema),
  controller.getSppgDetail
);
router.post("/", authenticate, authorize("admin"), validateRequest(createSppgSchema), controller.createSppg);
router.put("/:id", authenticate, authorize("admin"), validateRequest(updateSppgSchema), controller.updateSppg);
router.patch("/:id/restore", authenticate, authorize("admin"), validateRequest(sppgIdParamsSchema), controller.restoreSppg);
router.delete("/:id", authenticate, authorize("admin"), validateRequest(sppgIdParamsSchema), controller.deleteSppg);

module.exports = router;
