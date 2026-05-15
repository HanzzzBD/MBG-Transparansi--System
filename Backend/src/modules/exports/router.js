const express = require("express");

const controller = require("./controller");
const { createExportSchema, exportIdParamsSchema } = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { exportLimiter } = require("../../middlewares/rateLimiter");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate, authorize("pemerintah", "admin"));

router.post("/", exportLimiter, validateRequest(createExportSchema), controller.createExport);
router.get("/:id", validateRequest(exportIdParamsSchema), controller.getExportDetail);
router.get("/:id/download", validateRequest(exportIdParamsSchema), controller.downloadExport);

module.exports = router;
