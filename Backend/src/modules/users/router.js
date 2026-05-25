const express = require("express");

const controller = require("./controller");
const {
  adminUserIdParamsSchema,
  createUserSchema,
  listUsersSchema,
  updateUserSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/", validateRequest(listUsersSchema), controller.listUsers);
router.post("/", validateRequest(createUserSchema), controller.createUser);
router.patch("/:id", validateRequest(updateUserSchema), controller.updateUser);
router.delete("/:id", validateRequest(adminUserIdParamsSchema), controller.deleteUser);

module.exports = router;
