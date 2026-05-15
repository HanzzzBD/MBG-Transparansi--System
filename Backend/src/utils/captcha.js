const { env } = require("../config/env");
const AppError = require("./appError");

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

const resolveCaptchaProvider = () => {
  if (env.CAPTCHA_PROVIDER) {
    return env.CAPTCHA_PROVIDER;
  }

  if (env.TURNSTILE_SECRET_KEY) {
    return "turnstile";
  }

  if (env.RECAPTCHA_SECRET_KEY) {
    return "recaptcha";
  }

  return null;
};

const verifyTurnstileToken = async (captchaToken, ipAddress) => {
  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: captchaToken,
      ...(ipAddress ? { remoteip: ipAddress } : {})
    })
  });

  if (!response.ok) {
    throw new AppError("CAPTCHA verification service is unavailable.", 503, "CAPTCHA_SERVICE_UNAVAILABLE");
  }

  const payload = await response.json();

  if (!payload.success) {
    throw new AppError("CAPTCHA verification failed.", 400, "CAPTCHA_VERIFICATION_FAILED");
  }
};

const verifyRecaptchaToken = async (captchaToken, ipAddress) => {
  const response = await fetch(RECAPTCHA_VERIFY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      secret: env.RECAPTCHA_SECRET_KEY,
      response: captchaToken,
      ...(ipAddress ? { remoteip: ipAddress } : {})
    })
  });

  if (!response.ok) {
    throw new AppError("CAPTCHA verification service is unavailable.", 503, "CAPTCHA_SERVICE_UNAVAILABLE");
  }

  const payload = await response.json();

  if (!payload.success || typeof payload.score !== "number" || payload.score < env.RECAPTCHA_MIN_SCORE) {
    throw new AppError("CAPTCHA verification failed.", 400, "CAPTCHA_VERIFICATION_FAILED");
  }
};

const verifyCaptchaToken = async (captchaToken, ipAddress) => {
  if (!captchaToken || typeof captchaToken !== "string" || !captchaToken.trim()) {
    throw new AppError("CAPTCHA token is required.", 400, "CAPTCHA_TOKEN_REQUIRED");
  }

  const provider = resolveCaptchaProvider();

  if (!provider) {
    throw new AppError("CAPTCHA provider is not configured.", 503, "CAPTCHA_PROVIDER_NOT_CONFIGURED");
  }

  if (provider === "turnstile") {
    if (!env.TURNSTILE_SECRET_KEY) {
      throw new AppError("Turnstile secret key is not configured.", 503, "CAPTCHA_PROVIDER_NOT_CONFIGURED");
    }

    await verifyTurnstileToken(captchaToken.trim(), ipAddress);
    return true;
  }

  if (!env.RECAPTCHA_SECRET_KEY) {
    throw new AppError("reCAPTCHA secret key is not configured.", 503, "CAPTCHA_PROVIDER_NOT_CONFIGURED");
  }

  await verifyRecaptchaToken(captchaToken.trim(), ipAddress);
  return true;
};

const shouldSilentlyRejectHoneypot = (honeypotValue) =>
  typeof honeypotValue === "string" && honeypotValue.trim().length > 0;

module.exports = {
  shouldSilentlyRejectHoneypot,
  verifyCaptchaToken
};
