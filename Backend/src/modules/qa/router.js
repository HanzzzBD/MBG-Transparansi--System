const express = require("express");

const { env } = require("../../config/env");
const { getPrismaClient } = require("../../config/prisma");
const { resetLoginRateLimit } = require("../../middlewares/rateLimiter");
const AppError = require("../../utils/appError");

const router = express.Router();
const prisma = getPrismaClient();

router.use((req, _res, next) => {
  if (env.NODE_ENV === "production") {
    return next(new AppError("QA helpers are not available in production.", 404, "QA_HELPER_DISABLED"));
  }

  return next();
});

router.post("/reset-login-rate-limit", async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : null;
    const ipAddress = typeof req.body?.ip === "string" && req.body.ip.trim() ? req.body.ip.trim() : req.ip;

    const reset = await resetLoginRateLimit({
      email,
      ipAddress
    });

    if (email || ipAddress) {
      await prisma.loginAttempt.deleteMany({
        where: {
          ...(email ? { email } : {}),
          ...(ipAddress ? { ipAddress } : {})
        }
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        ...reset,
        email: email || null,
        ipAddress: ipAddress || null
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
