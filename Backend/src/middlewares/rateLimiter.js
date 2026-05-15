const { ipKeyGenerator, rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");

const { env } = require("../config/env");
const { getRedisClient } = require("../config/redis");
const AppError = require("../utils/appError");
const { extractBearerToken, verifyAccessToken } = require("../utils/auth");

const redisClient = getRedisClient();

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const FIFTEEN_MINUTES_MS = 15 * MINUTE_MS;

const normalizeEmailForRateLimit = (value) =>
  typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;

const buildStore = (prefix) => {
  if (!redisClient) {
    return undefined;
  }

  return new RedisStore({
    prefix,
    sendCommand: (...command) => redisClient.call(command[0], ...command.slice(1))
  });
};

const buildErrorHandler =
  ({ message, code }) =>
  (_req, _res, next) => {
    next(new AppError(message, 429, code));
  };

const createLimiter = ({
  prefix,
  windowMs,
  limit,
  keyGenerator,
  message,
  code,
  skip,
  requestPropertyName
}) =>
  rateLimit({
    windowMs,
    limit,
    store: buildStore(prefix),
    legacyHeaders: false,
    standardHeaders: "draft-7",
    passOnStoreError: env.NODE_ENV !== "production",
    keyGenerator,
    skip,
    requestPropertyName,
    handler: buildErrorHandler({ message, code })
  });

const getRateLimitUserId = (req) => {
  const token = extractBearerToken(req.get("authorization"));

  if (!token) {
    return null;
  }

  try {
    const payload = verifyAccessToken(token);
    return payload?.user_id ? String(payload.user_id) : null;
  } catch (_error) {
    return null;
  }
};

const getIpRateLimitKey = (req) => `ip:${ipKeyGenerator(req.ip)}`;

const requireUserRateLimitKey = (req) => {
  if (!req.user?.userId) {
    throw new AppError("Authentication is required.", 401, "AUTH_REQUIRED");
  }

  return `user:${req.user.userId}`;
};

const publicGetLimiter = createLimiter({
  prefix: "rl:public-get:",
  windowMs: MINUTE_MS,
  limit: 100,
  requestPropertyName: "publicRateLimit",
  keyGenerator: (req) => getIpRateLimitKey(req),
  skip: (req) => req.method !== "GET" || Boolean(getRateLimitUserId(req)),
  message: "Public API rate limit exceeded. Please try again shortly.",
  code: "PUBLIC_RATE_LIMIT_EXCEEDED"
});

const authenticatedGetLimiter = createLimiter({
  prefix: "rl:auth-get:",
  windowMs: MINUTE_MS,
  limit: 300,
  requestPropertyName: "authenticatedRateLimit",
  keyGenerator: (req) => `user:${getRateLimitUserId(req)}`,
  skip: (req) => req.method !== "GET" || !getRateLimitUserId(req),
  message: "Authenticated API rate limit exceeded. Please try again shortly.",
  code: "AUTHENTICATED_RATE_LIMIT_EXCEEDED"
});

const loginIpLimiter = createLimiter({
  prefix: "rl:login-ip:",
  windowMs: FIFTEEN_MINUTES_MS,
  limit: 5,
  requestPropertyName: "loginIpRateLimit",
  keyGenerator: (req) => getIpRateLimitKey(req),
  message: "Too many login attempts from this IP. Please try again later.",
  code: "LOGIN_IP_RATE_LIMIT_EXCEEDED"
});

const loginEmailLimiter = createLimiter({
  prefix: "rl:login-email:",
  windowMs: FIFTEEN_MINUTES_MS,
  limit: 5,
  requestPropertyName: "loginEmailRateLimit",
  keyGenerator: (req) => {
    const normalizedEmail = normalizeEmailForRateLimit(req.body?.email);
    return normalizedEmail ? `email:${normalizedEmail}` : `${getIpRateLimitKey(req)}:anonymous`;
  },
  message: "Too many login attempts for this email. Please try again later.",
  code: "LOGIN_EMAIL_RATE_LIMIT_EXCEEDED"
});

const publicReportLimiter = createLimiter({
  prefix: "rl:public-report:",
  windowMs: HOUR_MS,
  limit: 10,
  requestPropertyName: "publicReportRateLimit",
  keyGenerator: (req) => getIpRateLimitKey(req),
  message: "Public report rate limit exceeded. Please try again later.",
  code: "PUBLIC_REPORT_RATE_LIMIT_EXCEEDED"
});

const exportLimiter = createLimiter({
  prefix: "rl:exports:",
  windowMs: HOUR_MS,
  limit: 5,
  requestPropertyName: "exportRateLimit",
  keyGenerator: (req) => requireUserRateLimitKey(req),
  message: "Export rate limit exceeded. You can create up to 5 exports per hour.",
  code: "EXPORT_RATE_LIMIT_EXCEEDED"
});

const fileUploadLimiter = createLimiter({
  prefix: "rl:file-upload:",
  windowMs: HOUR_MS,
  limit: 20,
  requestPropertyName: "fileUploadRateLimit",
  keyGenerator: (req) => requireUserRateLimitKey(req),
  message: "Upload rate limit exceeded. You can upload up to 20 files per hour.",
  code: "FILE_UPLOAD_RATE_LIMIT_EXCEEDED"
});

const applyApiReadRateLimit = (req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }

  if (getRateLimitUserId(req)) {
    return authenticatedGetLimiter(req, res, next);
  }

  return publicGetLimiter(req, res, next);
};

module.exports = {
  applyApiReadRateLimit,
  authenticatedLimiter: authenticatedGetLimiter,
  exportLimiter,
  fileUploadLimiter,
  loginLimiter: [loginIpLimiter, loginEmailLimiter],
  publicLimiter: publicGetLimiter,
  publicReportLimiter
};
