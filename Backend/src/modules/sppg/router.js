const express = require("express");

const controller = require("./controller");
const {
  createSppgSchema,
  listSppgSchema,
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
  "/map-markers",
  authenticate,
  authorize("admin", "pemerintah", "sppg", "sekolah"),
  validateRequest(mapMarkersSchema),
  controller.listMapMarkers
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
router.delete("/:id", authenticate, authorize("admin"), validateRequest(sppgIdParamsSchema), controller.deleteSppg);

module.exports = router;
