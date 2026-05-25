const ACTION_LABELS = {
  INSERT: "Created Data",
  UPDATE: "Updated Data",
  DELETE: "Deleted Data",
  LOGIN: "User Login",
  LOGOUT: "User Logout",
  LOCK: "Locked Data",
  UNLOCK: "Unlocked Data",
  OVERRIDE: "Override Data"
};

const hasOverrideMarker = (log) => {
  const newData = log?.newData || {};
  return log?.tableName === "distributions" && log?.action === "UPDATE" && newData.override === true;
};

const getAuditAction = (log) => (hasOverrideMarker(log) ? "OVERRIDE" : log.action);

const getAuditCategory = (log) => {
  const action = getAuditAction(log);
  const tableName = String(log.tableName || "").toLowerCase();

  if (["LOGIN", "LOGOUT", "LOCK", "UNLOCK", "OVERRIDE"].includes(action)) return "Security";
  if (tableName.includes("user") || tableName.includes("login_attempt")) return "User";
  if (tableName.includes("config") || tableName.includes("anomaly") || tableName.includes("audit")) return "System";
  return "Data";
};

const getAuditSeverity = (log) => {
  const action = getAuditAction(log);
  const tableName = String(log.tableName || "").toLowerCase();

  if (["DELETE", "LOCK", "OVERRIDE"].includes(action)) return "HIGH";
  if (action === "UNLOCK" || tableName.includes("user") || tableName.includes("anomaly")) return "MEDIUM";
  return "LOW";
};

const summarizeChanges = (oldData, newData) => {
  if (!oldData && !newData) return "-";
  if (!oldData) {
    return Object.entries(newData || {})
      .slice(0, 2)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(", ");
  }

  const changes = [];
  Object.keys(newData || {}).forEach((key) => {
    if (JSON.stringify(oldData?.[key]) !== JSON.stringify(newData?.[key])) {
      changes.push(`${key}: ${String(oldData?.[key])} -> ${String(newData?.[key])}`);
    }
  });

  return changes.length ? changes.slice(0, 2).join(", ") : "Tidak ada perubahan field utama";
};

const serializeAuditLog = (log) => {
  const action = getAuditAction(log);
  const user = log.user || null;
  const category = getAuditCategory(log);
  const severity = getAuditSeverity(log);

  return {
    ...log,
    action,
    actionLabel: ACTION_LABELS[action] || action,
    action_label: ACTION_LABELS[action] || action,
    category,
    severity,
    userName: user?.name || user?.email || "System",
    user_name: user?.name || user?.email || "System",
    userRole: user?.role || null,
    user_role: user?.role || null,
    target: log.tableName,
    targetTable: log.tableName,
    target_table: log.tableName,
    changes: summarizeChanges(log.oldData, log.newData),
    description: `${ACTION_LABELS[action] || action} pada ${log.tableName || "record"}`,
    created_at: log.createdAt,
    ip_address: log.ipAddress
  };
};

module.exports = {
  getAuditAction,
  getAuditCategory,
  getAuditSeverity,
  serializeAuditLog
};
