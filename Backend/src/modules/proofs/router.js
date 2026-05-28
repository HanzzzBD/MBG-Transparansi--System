const express = require("express");

const controller = require("./controller");
const { createProofSchema, distributionProofsParamsSchema } = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.post(
  "/proofs",
  authenticate,
  authorize("sppg", "sekolah", "admin"),
  validateRequest(createProofSchema),
  controller.createProof
);
router.get(
  "/distributions/:id/proofs",
  authenticate,
  authorize("sppg", "sekolah", "pemerintah", "admin"),
  validateRequest(distributionProofsParamsSchema),
  controller.listDistributionProofs
);

module.exports = router;
