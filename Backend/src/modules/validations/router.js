const express = require("express");

const controller = require("./controller");
const {
  listValidationsSchema,
  updateValidationSchema,
  validationIdParamsSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize("sekolah", "pemerintah", "admin"),
  validateRequest(listValidationsSchema),
  controller.listValidations
);
router.get(
  "/:id",
  authorize("sekolah", "pemerintah", "admin"),
  validateRequest(validationIdParamsSchema),
  controller.getValidationDetail
);
router.put(
  "/:id",
  authorize("sekolah", "admin"),
  validateRequest(updateValidationSchema),
  controller.updateValidation
);

module.exports = router;
