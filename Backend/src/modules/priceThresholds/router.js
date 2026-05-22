const express = require("express");

const controller = require("./controller");
const {
  generatePriceThresholdsSchema,
  listPriceThresholdsSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize("pemerintah", "admin"),
  validateRequest(listPriceThresholdsSchema),
  controller.listPriceThresholds
);
router.post(
  "/generate-from-food-prices",
  authorize("admin"),
  validateRequest(generatePriceThresholdsSchema),
  controller.generateFromFoodPrices
);

module.exports = router;
