const express = require("express");

const controller = require("./controller");
const { auditLogIdParamsSchema, listAuditLogsSchema } = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { requirePermission } = require("../../middlewares/permissions");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate, authorize("pemerintah", "admin"));

router.get("/", requirePermission("audit.view"), validateRequest(listAuditLogsSchema), controller.listAuditLogs);
router.get("/summary", requirePermission("audit.view"), validateRequest(listAuditLogsSchema), controller.getAuditLogsSummary);
router.get("/:id", requirePermission("audit.view"), validateRequest(auditLogIdParamsSchema), controller.getAuditLogDetail);

module.exports = router;
