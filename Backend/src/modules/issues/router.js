const express = require("express");

const controller = require("./controller");
const {
  createIssueSchema,
  listIssuesSchema,
  updateIssueStatusSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { requirePermission } = require("../../middlewares/permissions");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize("sppg", "pemerintah", "admin"),
  requirePermission("issue.view"),
  validateRequest(listIssuesSchema),
  controller.listIssues
);
router.post(
  "/",
  authorize("sppg", "admin"),
  requirePermission("issue.create"),
  validateRequest(createIssueSchema),
  controller.createIssue
);
router.put(
  "/:id/status",
  authorize("admin"),
  requirePermission("issue.update_status"),
  validateRequest(updateIssueStatusSchema),
  controller.updateIssueStatus
);

module.exports = router;
