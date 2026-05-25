const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { endOfDayUtc, startOfDayUtc } = require("../../utils/date");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");
const {
  getAuditAction,
  getAuditCategory,
  getAuditSeverity,
  serializeAuditLog
} = require("./serializer");

const prisma = getPrismaClient();

const includeUser = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  }
};

const buildCreatedAtRange = (query = {}) => {
  const startDate = query.start_date || query.dateFrom || query.date_from;
  const endDate = query.end_date || query.dateTo || query.date_to;

  if (!startDate && !endDate) return undefined;

  return {
    ...(startDate ? { gte: startOfDayUtc(startDate) } : {}),
    ...(endDate ? { lte: endOfDayUtc(endDate) } : {})
  };
};

const buildBaseWhere = (query = {}) => {
  const search = String(query.search || "").trim();
  const action = String(query.action || "").trim().toUpperCase();
  const where = {
    ...(query.table_name || query.tableName ? { tableName: query.table_name || query.tableName } : {}),
    ...(query.user_id || query.userId ? { userId: Number(query.user_id || query.userId) } : {}),
    ...(buildCreatedAtRange(query) ? { createdAt: buildCreatedAtRange(query) } : {})
  };

  if (action && action !== "OVERRIDE") {
    where.action = action;
  }

  if (action === "OVERRIDE") {
    where.action = "UPDATE";
    where.tableName = "distributions";
  }

  if (search) {
    where.OR = [
      {
        tableName: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        ipAddress: {
          contains: search,
          mode: "insensitive"
        }
      },
      {
        user: {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive"
              }
            },
            {
              email: {
                contains: search,
                mode: "insensitive"
              }
            }
          ]
        }
      },
      ...(Number.isInteger(Number(search)) ? [{ recordId: Number(search) }] : [])
    ];
  }

  return where;
};

const matchesDerivedFilters = (log, query = {}) => {
  const action = String(query.action || "").trim().toUpperCase();
  const category = String(query.category || "").trim().toLowerCase();
  const severity = String(query.severity || "").trim().toUpperCase();

  if (action && getAuditAction(log) !== action) return false;
  if (category && getAuditCategory(log).toLowerCase() !== category) return false;
  if (severity && getAuditSeverity(log) !== severity) return false;

  return true;
};

const getFilteredAuditLogs = async (query = {}) => {
  const items = await prisma.auditLog.findMany({
    where: buildBaseWhere(query),
    include: includeUser,
    orderBy: [{ createdAt: "desc" }]
  });

  return items.filter((item) => matchesDerivedFilters(item, query));
};

const listAuditLogs = async ({ query = {} }) => {
  const pagination = parsePagination(query);
  const filtered = await getFilteredAuditLogs(query);
  const pageRows = filtered.slice(pagination.skip, pagination.skip + pagination.limit);

  return {
    data: pageRows.map(serializeAuditLog),
    meta: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total: filtered.length
    })
  };
};

const getAuditLogDetail = async ({ id }) => {
  const log = await prisma.auditLog.findUnique({
    where: {
      id: Number(id)
    },
    include: includeUser
  });

  if (!log) {
    throw new AppError("Audit log not found.", 404, "AUDIT_LOG_NOT_FOUND");
  }

  return {
    data: serializeAuditLog(log)
  };
};

const incrementCount = (target, key) => {
  target[key] = (target[key] || 0) + 1;
};

const getAuditLogsSummary = async ({ query = {} } = {}) => {
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayRange = {
    gte: startOfDayUtc(todayKey),
    lte: endOfDayUtc(todayKey)
  };
  const filtered = await getFilteredAuditLogs(query);
  const severityCount = {};
  const categoryCount = {};
  const actionCount = {};
  const activeUsers = new Set();

  filtered.forEach((log) => {
    incrementCount(severityCount, getAuditSeverity(log));
    incrementCount(categoryCount, getAuditCategory(log));
    incrementCount(actionCount, getAuditAction(log));

    if (log.userId) {
      activeUsers.add(log.userId);
    }
  });

  const totalToday = filtered.filter((log) => log.createdAt >= todayRange.gte && log.createdAt <= todayRange.lte).length;

  return {
    data: {
      totalLogs: filtered.length,
      total_logs: filtered.length,
      totalToday,
      total_today: totalToday,
      highSeverity: severityCount.HIGH || 0,
      high_severity: severityCount.HIGH || 0,
      activeUsers: activeUsers.size,
      active_users: activeUsers.size,
      severityCount,
      severity_count: severityCount,
      categoryCount,
      category_count: categoryCount,
      actionCount,
      action_count: actionCount
    }
  };
};

module.exports = {
  getAuditLogDetail,
  getAuditLogsSummary,
  listAuditLogs
};
