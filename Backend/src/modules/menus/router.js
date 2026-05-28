const express = require("express");

const controller = require("./controller");
const {
  createMenuSchema,
  listMenusSchema,
  menuIdParamsSchema,
  updateMenuSchema,
  validateMenuPriceSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { requirePermission } = require("../../middlewares/permissions");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("sppg", "admin", "pemerintah"),
  requirePermission("daily_menu.view"),
  validateRequest(listMenusSchema),
  controller.listMenus
);
router.post(
  "/",
  authenticate,
  authorize("sppg", "admin"),
  requirePermission("daily_menu.create"),
  validateRequest(createMenuSchema),
  controller.createMenu
);
router.put(
  "/:id",
  authenticate,
  authorize("sppg", "admin"),
  requirePermission("daily_menu.update"),
  validateRequest(updateMenuSchema),
  controller.updateMenu
);
router.post(
  "/:id/price-validation",
  authenticate,
  authorize("sppg", "admin"),
  requirePermission("daily_menu.price.validate"),
  validateRequest(validateMenuPriceSchema),
  controller.validateMenuPrice
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  requirePermission("daily_menu.delete"),
  validateRequest(menuIdParamsSchema),
  controller.deleteMenu
);

module.exports = router;
