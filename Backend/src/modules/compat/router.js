const express = require("express");

const { getPrismaClient } = require("../../config/prisma");
const { authenticate } = require("../../middlewares/auth");
const { authorize } = require("../../middlewares/rbac");
const AppError = require("../../utils/appError");
const { getClientIp } = require("../../utils/request");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");
const adminService = require("../admin/service");

const prisma = getPrismaClient();
const router = express.Router();

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const sendSuccess = (res, { data, meta, statusCode = 200 }) => {
  res.status(statusCode).json({
    status: "success",
    data,
    ...(meta ? { meta } : {})
  });
};

const mapBooleanQuery = (value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
};

const mapUserQuery = (query = {}) => ({
  ...query,
  isActive:
    query.status === "active"
      ? true
      : query.status === "inactive"
        ? false
        : mapBooleanQuery(query.isActive)
});

router.get(
  "/roles",
  authenticate,
  authorize("admin"),
  asyncHandler(async (_req, res) => {
    const result = await adminService.listRoles();
    sendSuccess(res, result);
  })
);

const mapAuditQuery = (query = {}) => {
  const mapped = {
    page: query.page,
    limit: query.limit,
    table_name: query.table_name || query.tableName,
    user_id: query.user_id || query.userId,
    start_date: query.start_date || query.dateFrom,
    end_date: query.end_date || query.dateTo
  };

  if (["INSERT", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "LOCK", "UNLOCK"].includes(query.action)) {
    mapped.action = query.action;
  }

  return mapped;
};

const mapAnomalyQuery = (query = {}) => ({
  page: query.page,
  limit: query.limit,
  anomaly_type: query.anomaly_type || query.type,
  is_resolved:
    query.status === "resolved"
      ? true
      : query.status === "unresolved"
        ? false
        : mapBooleanQuery(query.is_resolved ?? query.isResolved)
});

const listExports = async ({ query = {}, user }) => {
  const pagination = parsePagination(query);
  const where = {
    ...(user.role === "admin" ? {} : { userId: user.userId }),
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {})
  };

  const [items, total] = await Promise.all([
    prisma.export.findMany({
      where,
      include: {
        file: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.export.count({ where })
  ]);

  return {
    data: items,
    meta: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total
    })
  };
};

const getMonitoringSummary = async () => {
  const [
    usersTotal,
    usersActive,
    sppgTotal,
    schoolsTotal,
    distributionsTotal,
    pendingExports,
    failedExports,
    unresolvedAnomalies
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true, deletedAt: null } }),
    prisma.sppg.count({ where: { deletedAt: null } }),
    prisma.school.count({ where: { deletedAt: null } }),
    prisma.distribution.count(),
    prisma.export.count({ where: { status: { in: ["pending", "processing"] } } }),
    prisma.export.count({ where: { status: "failed" } }),
    prisma.anomalyLog.count({ where: { isResolved: false } })
  ]);

  return {
    service: "MBG Transparency System Backend",
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    totals: {
      usersTotal,
      usersActive,
      sppgTotal,
      schoolsTotal,
      distributionsTotal,
      pendingExports,
      failedExports,
      unresolvedAnomalies
    }
  };
};

router.get(
  "/users",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const result = await adminService.listUsers({
      query: mapUserQuery(req.query)
    });
    sendSuccess(res, result);
  })
);

router.post(
  "/users",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const requiredFields = ["name", "email", "password", "role"];
    const missingFields = requiredFields.filter((field) => !req.body?.[field]);

    if (missingFields.length > 0) {
      throw new AppError(
        `Missing required fields: ${missingFields.join(", ")}.`,
        400,
        "USER_PAYLOAD_INVALID"
      );
    }

    const result = await adminService.createUser({
      payload: req.body,
      actorUserId: req.user.userId,
      ipAddress: getClientIp(req)
    });
    sendSuccess(res, { data: result.data, statusCode: 201 });
  })
);

router.patch(
  "/users/:id/status",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    if (typeof req.body?.isActive !== "boolean") {
      throw new AppError("isActive boolean is required.", 400, "USER_STATUS_INVALID");
    }

    const result = await adminService.updateUser({
      id: req.params.id,
      payload: {
        isActive: req.body.isActive
      },
      actorUserId: req.user.userId,
      ipAddress: getClientIp(req)
    });
    sendSuccess(res, result);
  })
);

router.patch(
  "/users/:id",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new AppError("At least one field must be provided.", 400, "USER_PAYLOAD_EMPTY");
    }

    const result = await adminService.updateUser({
      id: req.params.id,
      payload: req.body,
      actorUserId: req.user.userId,
      ipAddress: getClientIp(req)
    });
    sendSuccess(res, result);
  })
);

router.delete(
  "/users/:id",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const result = await adminService.deleteUser({
      id: req.params.id,
      actorUserId: req.user.userId,
      ipAddress: getClientIp(req)
    });
    sendSuccess(res, result);
  })
);

router.get(
  "/audit-logs/summary",
  authenticate,
  authorize("pemerintah", "admin"),
  asyncHandler(async (_req, res) => {
    const result = await adminService.getAuditLogsSummary();
    sendSuccess(res, result);
  })
);

router.get(
  "/audit-logs",
  authenticate,
  authorize("pemerintah", "admin"),
  asyncHandler(async (req, res) => {
    const result = await adminService.listAuditLogs({
      query: mapAuditQuery(req.query)
    });
    sendSuccess(res, result);
  })
);

router.get(
  "/anomaly-logs",
  authenticate,
  authorize("pemerintah", "admin"),
  asyncHandler(async (req, res) => {
    const result = await adminService.listAnomalyLogs({
      query: mapAnomalyQuery(req.query)
    });
    sendSuccess(res, result);
  })
);

router.patch(
  "/anomaly-logs/:id/resolve",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const result = await adminService.resolveAnomalyLog({
      id: req.params.id,
      actorUserId: req.user.userId,
      ipAddress: getClientIp(req)
    });
    sendSuccess(res, result);
  })
);

router.get(
  "/exports",
  authenticate,
  authorize("pemerintah", "admin"),
  asyncHandler(async (req, res) => {
    const result = await listExports({
      query: req.query,
      user: req.user
    });
    sendSuccess(res, result);
  })
);

router.patch(
  "/distributions/:id/lock",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const result = await adminService.lockDistribution({
      id: req.params.id,
      actorUserId: req.user.userId,
      ipAddress: getClientIp(req),
      reason: req.body.reason ?? null
    });
    sendSuccess(res, result);
  })
);

router.patch(
  "/distributions/:id/unlock",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const result = await adminService.unlockDistribution({
      id: req.params.id,
      actorUserId: req.user.userId,
      ipAddress: getClientIp(req),
      reason: req.body.reason ?? null,
      autoRelockAfterOneHour: req.body.autoRelockAfterOneHour !== false
    });
    sendSuccess(res, result);
  })
);

router.patch(
  "/distributions/:id/override",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const payload = req.body.changes
      ? {
          ...req.body.changes,
          overrideReason: req.body.reason || req.body.overrideReason
        }
      : req.body;

    const result = await adminService.overrideDistribution({
      id: req.params.id,
      payload,
      actorUserId: req.user.userId,
      ipAddress: getClientIp(req)
    });
    sendSuccess(res, result);
  })
);

router.get(
  "/system-configs/export_max_rows",
  authenticate,
  authorize("pemerintah", "admin"),
  asyncHandler(async (_req, res) => {
    const result = await adminService.getReadableSystemConfig({
      key: "export_max_rows"
    });
    sendSuccess(res, result);
  })
);

router.get(
  "/system-configs/:key",
  authenticate,
  authorize("pemerintah", "admin"),
  asyncHandler(async (req, res) => {
    const result = await adminService.getReadableSystemConfig({
      key: req.params.key
    });
    sendSuccess(res, result);
  })
);

router.get(
  "/monitoring/summary",
  authenticate,
  authorize("admin"),
  asyncHandler(async (_req, res) => {
    const data = await getMonitoringSummary();
    sendSuccess(res, { data });
  })
);

module.exports = router;
