const express = require("express");

const controller = require("./controller");
const {
  estimateSchema,
  importFoodPricesSchema,
  latestFoodPricesSchema,
  listFoodPricesSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("pemerintah", "admin"), validateRequest(listFoodPricesSchema), controller.listFoodPrices);
router.get(
  "/latest",
  authorize("pemerintah", "admin"),
  validateRequest(latestFoodPricesSchema),
  controller.getLatestFoodPrices
);
router.get(
  "/estimate",
  authorize("pemerintah", "admin"),
  validateRequest(estimateSchema),
  controller.getEstimate
);
router.post(
  "/import",
  authorize("admin"),
  validateRequest(importFoodPricesSchema),
  controller.importFoodPriceData
);

module.exports = router;
