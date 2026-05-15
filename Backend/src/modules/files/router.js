const express = require("express");

const controller = require("./controller");
const { uploadSingleImage } = require("./upload");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { fileUploadLimiter } = require("../../middlewares/rateLimiter");

const router = express.Router();

router.post(
  "/upload",
  authenticate,
  authorize("sppg", "admin"),
  fileUploadLimiter,
  uploadSingleImage("file"),
  controller.uploadFile
);

module.exports = router;
