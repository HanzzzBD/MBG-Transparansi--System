const express = require("express");

const controller = require("./controller");
const {
  createIssueSchema,
  listIssuesSchema,
  updateIssueStatusSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("sppg", "pemerintah", "admin"), validateRequest(listIssuesSchema), controller.listIssues);
router.post("/", authorize("sppg", "admin"), validateRequest(createIssueSchema), controller.createIssue);
router.put(
  "/:id/status",
  authorize("admin"),
  validateRequest(updateIssueStatusSchema),
  controller.updateIssueStatus
);

module.exports = router;
