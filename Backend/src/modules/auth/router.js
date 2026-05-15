const express = require("express");

const authController = require("./controller");
const { loginSchema, registerSchema } = require("./validation");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const { loginLimiter } = require("../../middlewares/rateLimiter");
const { validateRequest } = require("../../middlewares/validateRequest");

const router = express.Router();

router.post("/register", authenticate, authorize("admin"), validateRequest(registerSchema), authController.register);
router.post("/login", ...loginLimiter, validateRequest(loginSchema), authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);

module.exports = router;
