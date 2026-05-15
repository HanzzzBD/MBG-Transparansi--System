const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const { env } = require("../config/env");

const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_DAYS = 30;
const BCRYPT_ROUNDS = 12;

const extractBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || typeof authorizationHeader !== "string") {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

const signAccessToken = (user) =>
  jwt.sign(
    {
      user_id: user.id,
      role: user.role,
      email: user.email
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN
    }
  );

const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);

const generateRefreshToken = () => crypto.randomBytes(48).toString("hex");

const hashRefreshToken = (token) =>
  crypto.createHash("sha256").update(token, "utf8").digest("hex");

const getRefreshTokenExpiresAt = () => new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

const getRefreshCookieBaseOptions = () => ({
  httpOnly: true,
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  secure: env.NODE_ENV === "production",
  path: "/api/auth"
});

const getRefreshCookieOptions = () => ({
  ...getRefreshCookieBaseOptions(),
  maxAge: REFRESH_TOKEN_TTL_MS
});

module.exports = {
  ACCESS_TOKEN_EXPIRES_IN,
  BCRYPT_ROUNDS,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_TTL_DAYS,
  REFRESH_TOKEN_TTL_MS,
  extractBearerToken,
  generateRefreshToken,
  getRefreshCookieBaseOptions,
  getRefreshCookieOptions,
  getRefreshTokenExpiresAt,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken
};
