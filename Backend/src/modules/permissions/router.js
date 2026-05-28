const express = require("express");

const controller = require("./controller");
const { authenticate } = require("../../middlewares/auth");
const { requirePermission } = require("../../middlewares/permissions");
const { authorize } = require("../../middlewares/rbac");

const router = express.Router();

router.get("/me/permissions", authenticate, controller.getMyPermissions);

router.get(
  "/permissions",
  authenticate,
  authorize("admin"),
  requirePermission("permission.view"),
  controller.listPermissions
);

module.exports = router;
