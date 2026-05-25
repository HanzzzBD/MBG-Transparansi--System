const express = require("express");

const controller = require("./controller");
const { auditLogIdParamsSchema, listAuditLogsSchema } = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate, authorize("pemerintah", "admin"));

router.get("/", validateRequest(listAuditLogsSchema), controller.listAuditLogs);
router.get("/summary", validateRequest(listAuditLogsSchema), controller.getAuditLogsSummary);
router.get("/:id", validateRequest(auditLogIdParamsSchema), controller.getAuditLogDetail);

module.exports = router;
