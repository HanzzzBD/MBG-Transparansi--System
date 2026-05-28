const express = require("express");

const authController = require("./controller");
const {
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema
} = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { loginLimiter, passwordResetLimiter } = require("../../middlewares/rateLimiter");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.post("/register", authenticate, authorize("admin"), validateRequest(registerSchema), authController.register);
router.post("/login", ...loginLimiter, validateRequest(loginSchema), authController.login);
router.post(
  "/forgot-password",
  passwordResetLimiter,
  validateRequest(requestPasswordResetSchema),
  authController.requestPasswordReset
);
router.post("/reset-password", validateRequest(resetPasswordSchema), authController.resetPassword);
router.post("/session", authController.session);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);

module.exports = router;
