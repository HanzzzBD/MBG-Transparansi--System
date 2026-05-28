const express = require("express");

const controller = require("./controller");
const permissionController = require("../permissions/controller");
const {
  userPermissionKeyParamsSchema,
  userPermissionMutationSchema,
  userPermissionParamsSchema
} = require("../permissions/validation");
const {
  adminUserIdParamsSchema,
  createUserSchema,
  listUsersSchema,
  updateUserSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { requirePermission } = require("../../middlewares/permissions");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/", requirePermission("admin.users.manage"), validateRequest(listUsersSchema), controller.listUsers);
router.post("/", requirePermission("admin.users.manage"), validateRequest(createUserSchema), controller.createUser);
router.get(
  "/:id/permissions",
  requirePermission("permission.view"),
  validateRequest(userPermissionParamsSchema),
  permissionController.getUserPermissions
);
router.post(
  "/:id/permissions/grant",
  requirePermission("permission.grant"),
  validateRequest(userPermissionMutationSchema),
  permissionController.grantUserPermission
);
router.post(
  "/:id/permissions/revoke",
  requirePermission("permission.revoke"),
  validateRequest(userPermissionMutationSchema),
  permissionController.revokeUserPermission
);
router.post(
  "/:id/permissions/deny",
  requirePermission("permission.revoke"),
  validateRequest(userPermissionMutationSchema),
  permissionController.denyUserPermission
);
router.delete(
  "/:id/permissions/:permissionKey",
  requirePermission("permission.revoke"),
  validateRequest(userPermissionKeyParamsSchema),
  permissionController.resetUserPermissionOverride
);
router.patch("/:id", requirePermission("admin.users.manage"), validateRequest(updateUserSchema), controller.updateUser);
router.patch("/:id/restore", requirePermission("admin.users.manage"), validateRequest(adminUserIdParamsSchema), controller.restoreUser);
router.delete("/:id", requirePermission("admin.users.manage"), validateRequest(adminUserIdParamsSchema), controller.deleteUser);

module.exports = router;
