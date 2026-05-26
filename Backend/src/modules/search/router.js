const express = require("express");

const controller = require("./controller");
const { searchQuerySchema } = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.use(authenticate);
router.get(
  "/",
  authorize("admin", "pemerintah", "sppg", "sekolah"),
  validateRequest(searchQuerySchema),
  controller.search
);

module.exports = router;
