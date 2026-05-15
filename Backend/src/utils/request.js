const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0];
  }

  return req.ip || req.socket?.remoteAddress || null;
};

const getUserAgent = (req) => {
  const userAgent = req.get("user-agent");
  return typeof userAgent === "string" && userAgent.trim() ? userAgent.trim() : null;
};

module.exports = {
  getClientIp,
  getUserAgent
};
