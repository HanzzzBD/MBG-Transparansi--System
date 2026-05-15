const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const SCRIPT_TAG_PATTERN = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const STYLE_TAG_PATTERN = /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi;
const HTML_TAG_PATTERN = /<\/?[^>]+>/g;

const SANITIZE_EXCLUDED_KEYS = new Set([
  "password",
  "currentPassword",
  "newPassword",
  "captchaToken",
  "captcha_token",
  "hpField",
  "hp_field",
  "refreshToken",
  "refresh_token",
  "token"
]);

const stripHtml = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .replace(HTML_COMMENT_PATTERN, " ")
    .replace(SCRIPT_TAG_PATTERN, " ")
    .replace(STYLE_TAG_PATTERN, " ")
    .replace(HTML_TAG_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const sanitizeValue = (value, currentKey = null) => {
  if (typeof value === "string") {
    return currentKey && SANITIZE_EXCLUDED_KEYS.has(currentKey) ? value : stripHtml(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, currentKey));
  }

  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.entries(value).reduce((accumulator, [key, nestedValue]) => {
      accumulator[key] = sanitizeValue(nestedValue, key);
      return accumulator;
    }, {});
  }

  return value;
};

module.exports = {
  sanitizeValue,
  stripHtml
};
