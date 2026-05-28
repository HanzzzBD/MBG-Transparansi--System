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
const { requirePermission } = require("../../middlewares/permissions");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(["/production-batches", "/production-batch-items"], authenticate);

router.get(
  "/production-batches",
  authorize("sppg", "pemerintah", "admin"),
  requirePermission("production.view"),
  validateRequest(listProductionBatchesSchema),
  controller.listProductionBatches
);
router.get(
  "/production-batches/:id",
  authorize("sppg", "pemerintah", "admin"),
  requirePermission("production.view"),
  validateRequest(batchIdParamsSchema),
  controller.getProductionBatchDetail
);
router.post(
  "/production-batches",
  authorize("sppg", "admin"),
  requirePermission("production.create"),
  validateRequest(createProductionBatchSchema),
  controller.createProductionBatch
);
router.patch(
  "/production-batches/:id",
  authorize("sppg", "admin"),
  requirePermission("production.update"),
  validateRequest(updateProductionBatchSchema),
  controller.updateProductionBatch
);
router.delete(
  "/production-batches/:id",
  authorize("sppg", "admin"),
  requirePermission("production.delete"),
  validateRequest(batchIdParamsSchema),
  controller.deleteProductionBatch
);
router.post(
  "/production-batches/:id/items",
  authorize("sppg", "admin"),
  requirePermission("production.create"),
  validateRequest(createProductionBatchItemSchema),
  controller.addProductionBatchItem
);
router.get(
  "/production-batches/:id/cost-summary",
  authorize("sppg", "pemerintah", "admin"),
  requirePermission("production.view"),
  validateRequest(batchIdParamsSchema),
  controller.getCostSummary
);
router.get(
  "/production-batches/:id/anomalies",
  authorize("sppg", "pemerintah", "admin"),
  requirePermission("production.view"),
  validateRequest(batchIdParamsSchema),
  controller.getBatchAnomalies
);
router.patch(
  "/production-batch-items/:id",
  authorize("sppg", "admin"),
  requirePermission("production.update"),
  validateRequest(updateProductionBatchItemSchema),
  controller.updateProductionBatchItem
);
router.delete(
  "/production-batch-items/:id",
  authorize("sppg", "admin"),
  requirePermission("production.delete"),
  validateRequest(batchIdParamsSchema),
  controller.deleteProductionBatchItem
);

module.exports = router;
