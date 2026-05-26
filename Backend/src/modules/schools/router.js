const express = require("express");

const controller = require("./controller");
const {
  createSchoolSchema,
  listDeletedSchoolsSchema,
  listSchoolsSchema,
  schoolIdParamsSchema,
  updateSchoolSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("pemerintah", "admin"), validateRequest(listSchoolsSchema), controller.listSchools);
router.get(
  "/deleted",
  authorize("admin"),
  validateRequest(listDeletedSchoolsSchema),
  controller.listDeletedSchools
);
router.get(
  "/:id",
  authorize("pemerintah", "admin", "sekolah"),
  validateRequest(schoolIdParamsSchema),
  controller.getSchoolDetail
);
router.post("/", authorize("admin"), validateRequest(createSchoolSchema), controller.createSchool);
router.put("/:id", authorize("admin"), validateRequest(updateSchoolSchema), controller.updateSchool);
router.patch("/:id/restore", authorize("admin"), validateRequest(schoolIdParamsSchema), controller.restoreSchool);
router.delete("/:id", authorize("admin"), validateRequest(schoolIdParamsSchema), controller.deleteSchool);

module.exports = router;
