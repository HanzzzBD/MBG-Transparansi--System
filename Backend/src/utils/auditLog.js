const SENSITIVE_KEYS = new Set([
  "password",
  "refreshToken",
  "refresh_token",
  "accessToken",
  "access_token"
]);

const sanitizeAuditPayload = (value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value && typeof value === "object" && typeof value.toJSON === "function") {
    return sanitizeAuditPayload(value.toJSON());
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeAuditPayload);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((accumulator, [key, nestedValue]) => {
      accumulator[key] = SENSITIVE_KEYS.has(key) ? "[REDACTED]" : sanitizeAuditPayload(nestedValue);
      return accumulator;
    }, {});
  }

  return value;
};

const createAuditLog = async ({
  prisma,
  userId = null,
  action,
  tableName,
  recordId,
  oldData = null,
  newData = null,
  ipAddress = null
}) => {
  return prisma.auditLog.create({
    data: {
      userId,
      action,
      tableName,
      recordId,
      oldData: oldData ? sanitizeAuditPayload(oldData) : undefined,
      newData: newData ? sanitizeAuditPayload(newData) : undefined,
      ipAddress
    }
  });
};

module.exports = {
  createAuditLog
};
