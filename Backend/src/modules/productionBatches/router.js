const express = require("express");

const controller = require("./controller");
const {
  batchIdParamsSchema,
  createProductionBatchItemSchema,
  createProductionBatchSchema,
  listProductionBatchesSchema,
  updateProductionBatchItemSchema,
  updateProductionBatchSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(["/production-batches", "/production-batch-items"], authenticate);

router.get(
  "/production-batches",
  authorize("sppg", "pemerintah", "admin"),
  validateRequest(listProductionBatchesSchema),
  controller.listProductionBatches
);
router.get(
  "/production-batches/:id",
  authorize("sppg", "pemerintah", "admin"),
  validateRequest(batchIdParamsSchema),
  controller.getProductionBatchDetail
);
router.post(
  "/production-batches",
  authorize("sppg", "admin"),
  validateRequest(createProductionBatchSchema),
  controller.createProductionBatch
);
router.patch(
  "/production-batches/:id",
  authorize("sppg", "admin"),
  validateRequest(updateProductionBatchSchema),
  controller.updateProductionBatch
);
router.delete(
  "/production-batches/:id",
  authorize("sppg", "admin"),
  validateRequest(batchIdParamsSchema),
  controller.deleteProductionBatch
);
router.post(
  "/production-batches/:id/items",
  authorize("sppg", "admin"),
  validateRequest(createProductionBatchItemSchema),
  controller.addProductionBatchItem
);
router.get(
  "/production-batches/:id/cost-summary",
  authorize("sppg", "pemerintah", "admin"),
  validateRequest(batchIdParamsSchema),
  controller.getCostSummary
);
router.get(
  "/production-batches/:id/anomalies",
  authorize("sppg", "pemerintah", "admin"),
  validateRequest(batchIdParamsSchema),
  controller.getBatchAnomalies
);
router.patch(
  "/production-batch-items/:id",
  authorize("sppg", "admin"),
  validateRequest(updateProductionBatchItemSchema),
  controller.updateProductionBatchItem
);
router.delete(
  "/production-batch-items/:id",
  authorize("sppg", "admin"),
  validateRequest(batchIdParamsSchema),
  controller.deleteProductionBatchItem
);

module.exports = router;
