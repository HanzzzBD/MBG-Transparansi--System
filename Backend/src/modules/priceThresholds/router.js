const express = require("express");

const controller = require("./controller");
const {
  generatePriceThresholdsSchema,
  listPriceThresholdsSchema,
  myRegionPriceThresholdSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { requirePermission } = require("../../middlewares/permissions");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate);

router.get(
  "/my-region",
  authorize("sppg"),
  validateRequest(myRegionPriceThresholdSchema),
  controller.getMyRegionThreshold
);
router.get(
  "/",
  authorize("pemerintah", "admin"),
  validateRequest(listPriceThresholdsSchema),
  controller.listPriceThresholds
);
router.post(
  "/generate-from-food-prices",
  authorize("admin"),
  requirePermission("daily_menu.price.validate"),
  validateRequest(generatePriceThresholdsSchema),
  controller.generateFromFoodPrices
);

module.exports = router;
