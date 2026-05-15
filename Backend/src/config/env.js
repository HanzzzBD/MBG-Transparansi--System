const { config } = require("dotenv");
const { z } = require("zod");

config();

const normalizeEnvValue = (value, fallback = "") => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const rawEnv = {
  NODE_ENV: normalizeEnvValue(process.env.NODE_ENV, "development"),
  PORT: normalizeEnvValue(process.env.PORT, "4000"),
  DATABASE_URL: normalizeEnvValue(process.env.DATABASE_URL),
  REDIS_URL: normalizeEnvValue(process.env.REDIS_URL),
  JWT_ACCESS_SECRET: normalizeEnvValue(process.env.JWT_ACCESS_SECRET),
  JWT_REFRESH_SECRET: normalizeEnvValue(process.env.JWT_REFRESH_SECRET),
  R2_ACCOUNT_ID: normalizeEnvValue(process.env.R2_ACCOUNT_ID),
  R2_ACCESS_KEY_ID: normalizeEnvValue(process.env.R2_ACCESS_KEY_ID),
  R2_SECRET_ACCESS_KEY: normalizeEnvValue(process.env.R2_SECRET_ACCESS_KEY),
  R2_BUCKET_NAME: normalizeEnvValue(process.env.R2_BUCKET_NAME),
  R2_PUBLIC_URL: normalizeEnvValue(process.env.R2_PUBLIC_URL),
  CLIENT_URL: normalizeEnvValue(process.env.CLIENT_URL, "http://localhost:5173"),
  CAPTCHA_PROVIDER: normalizeEnvValue(process.env.CAPTCHA_PROVIDER),
  TURNSTILE_SECRET_KEY: normalizeEnvValue(process.env.TURNSTILE_SECRET_KEY),
  RECAPTCHA_SECRET_KEY: normalizeEnvValue(process.env.RECAPTCHA_SECRET_KEY),
  RECAPTCHA_MIN_SCORE: normalizeEnvValue(process.env.RECAPTCHA_MIN_SCORE, "0.5")
};

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  REDIS_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required."),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required."),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  CLIENT_URL: z.string().min(1, "CLIENT_URL is required."),
  CAPTCHA_PROVIDER: z.enum(["turnstile", "recaptcha"]).optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  RECAPTCHA_SECRET_KEY: z.string().optional(),
  RECAPTCHA_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.5)
});

const parsedEnv = envSchema.safeParse(rawEnv);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues.map((issue) => issue.message).join(", ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

const env = parsedEnv.data;

const clientOrigins = env.CLIENT_URL.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  clientOrigins,
  env
};
