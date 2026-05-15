const { env } = require("../config/env");
const { sanitizeValue } = require("../utils/sanitize");

const isSecureRequest = (req) => {
  if (req.secure) {
    return true;
  }

  const forwardedProto = req.get("x-forwarded-proto");
  return typeof forwardedProto === "string" && forwardedProto.split(",")[0].trim() === "https";
};

const enforceHttps = (req, res, next) => {
  if (env.NODE_ENV !== "production" || isSecureRequest(req)) {
    return next();
  }

  const host = req.get("host");

  if (!host) {
    return next();
  }

  return res.redirect(308, `https://${host}${req.originalUrl}`);
};

const sanitizeRequestInput = (req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }

  if (req.query && typeof req.query === "object") {
    req.query = sanitizeValue(req.query);
  }

  if (req.params && typeof req.params === "object") {
    req.params = sanitizeValue(req.params);
  }

  next();
};

module.exports = {
  enforceHttps,
  sanitizeRequestInput
};
