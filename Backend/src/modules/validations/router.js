const express = require("express");

const controller = require("./controller");
const {
  listValidationsSchema,
  updateValidationSchema,
  validationIdParamsSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { requirePermission } = require("../../middlewares/permissions");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize("sekolah", "pemerintah", "admin"),
  requirePermission("distribution.view"),
  validateRequest(listValidationsSchema),
  controller.listValidations
);
router.get(
  "/:id",
  authorize("sekolah", "pemerintah", "admin"),
  requirePermission("distribution.view"),
  validateRequest(validationIdParamsSchema),
  controller.getValidationDetail
);
router.put(
  "/:id",
  authorize("sekolah", "admin"),
  requirePermission("distribution.confirm"),
  validateRequest(updateValidationSchema),
  controller.updateValidation
);
router.patch(
  "/:id",
  authorize("sekolah", "admin"),
  requirePermission("distribution.confirm"),
  validateRequest(updateValidationSchema),
  controller.updateValidation
);

module.exports = router;
