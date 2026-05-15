const express = require("express");

const controller = require("./controller");
const {
  createMenuSchema,
  listMenusSchema,
  menuIdParamsSchema,
  updateMenuSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.get("/", validateRequest(listMenusSchema), controller.listMenus);
router.post("/", authenticate, authorize("sppg", "admin"), validateRequest(createMenuSchema), controller.createMenu);
router.put("/:id", authenticate, authorize("sppg", "admin"), validateRequest(updateMenuSchema), controller.updateMenu);
router.delete("/:id", authenticate, authorize("admin"), validateRequest(menuIdParamsSchema), controller.deleteMenu);

module.exports = router;
