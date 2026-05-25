const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");
const { deleteStoredObject } = require("../../utils/storage");
const { assertExportDatasetsAllowed } = require("./datasets");
const { enqueueExportJob } = require("./runtime");
const { cleanupExpiredExports } = require("./processor");

const prisma = getPrismaClient();
const EXPORT_RETENTION_DAYS = 7;
const EXPIRED_EXPORT_MESSAGE = "Export file expired after the 7-day retention window.";

const exportInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  },
  file: true
};

const getExportById = async (id) => {
  const exportRecord = await prisma.export.findUnique({
    where: {
      id: Number(id)
    },
    include: exportInclude
  });

  if (!exportRecord) {
    throw new AppError("Export record not found.", 404, "EXPORT_NOT_FOUND");
  }

  return exportRecord;
};

const ensureExportAccess = (user, exportRecord) => {
  if (user.role === "admin") {
    return;
  }

  if (Number(exportRecord.userId) !== Number(user.userId)) {
    throw new AppError("You can only access your own export jobs.", 403, "EXPORT_SCOPE_FORBIDDEN");
  }
};

const getExpiresAt = (exportRecord) => {
  const createdAt = exportRecord.createdAt || new Date();
  return new Date(new Date(createdAt).getTime() + EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
};

const isExpiredExport = (exportRecord) => {
  if (exportRecord.errorMsg?.toLowerCase().includes("expired")) {
    return true;
  }

  return exportRecord.status === "done" && getExpiresAt(exportRecord) <= new Date();
};

const getApiStatus = (exportRecord) => {
  if (isExpiredExport(exportRecord)) {
    return "expired";
  }

  if (exportRecord.status === "done") {
    return "completed";
  }

  if (exportRecord.status === "failed") {
    return "failed";
  }

  return "processing";
};

const getProgressPercent = (exportRecord) => {
  const status = getApiStatus(exportRecord);

  if (status === "completed") return 100;
  if (status === "failed" || status === "expired") return 0;
  if (exportRecord.status === "processing") return 55;
  return 10;
};

const getRowCount = (exportRecord) => {
  const filters = exportRecord.filterParams || {};
  return Number(filters.rowCount || filters.row_count || filters.estimatedRows || filters.estimated_rows || 0);
};

const serializeExport = (exportRecord) => {
  const status = getApiStatus(exportRecord);
  const expiresAt = getExpiresAt(exportRecord);
  const fileSize = Number(exportRecord.file?.sizeBytes || 0);
  const rowCount = getRowCount(exportRecord);

  return {
    ...exportRecord,
    status,
    backendStatus: exportRecord.status,
    backend_status: exportRecord.status,
    progressPercent: getProgressPercent(exportRecord),
    progress_percent: getProgressPercent(exportRecord),
    fileSize,
    file_size: fileSize,
    rowCount,
    row_count: rowCount,
    expiresAt,
    expires_at: expiresAt,
    file: exportRecord.file
      ? {
          ...exportRecord.file,
          sizeBytes: exportRecord.file.sizeBytes,
          size_bytes: exportRecord.file.sizeBytes,
          expiresAt,
          expires_at: expiresAt
        }
      : null
  };
};

const expireOldExports = async () => {
  await cleanupExpiredExports();
};

const createExport = async ({ payload, user, ipAddress }) => {
  const filterParams = payload.filterParams || payload.filters || {};
  assertExportDatasetsAllowed({ filterParams, user });

  const exportRecord = await prisma.$transaction(async (tx) => {
    const created = await tx.export.create({
      data: {
        userId: user.userId,
        type: payload.type,
        filterParams,
        status: "pending"
      },
      include: exportInclude
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "INSERT",
      tableName: "exports",
      recordId: created.id,
      newData: created,
      ipAddress
    });

    return created;
  });

  try {
    await enqueueExportJob({
      exportId: exportRecord.id
    });
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.export.findUnique({
        where: {
          id: exportRecord.id
        }
      });

      const failed = await tx.export.update({
        where: {
          id: exportRecord.id
        },
        data: {
          status: "failed",
          errorMsg: error.message || "Failed to queue export job."
        }
      });

      await createAuditLog({
        prisma: tx,
        userId: user.userId,
        action: "UPDATE",
        tableName: "exports",
        recordId: failed.id,
        oldData: current,
        newData: failed,
        ipAddress
      });
    });

    throw new AppError("Failed to queue export job.", 500, "EXPORT_QUEUE_FAILED", {
      reason: error.message
    });
  }

  return {
    data: serializeExport(exportRecord)
  };
};

const listExports = async ({ query = {}, user }) => {
  await expireOldExports();
  const pagination = parsePagination(query);
  const where = user.role === "admin" ? {} : { userId: user.userId };

  const [items, total] = await Promise.all([
    prisma.export.findMany({
      where,
      include: exportInclude,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.export.count({ where })
  ]);

  return {
    data: items.map(serializeExport),
    meta: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total
    })
  };
};

const getExportDetail = async ({ id, user }) => {
  await expireOldExports();
  const exportRecord = await getExportById(id);
  ensureExportAccess(user, exportRecord);

  return {
    data: serializeExport(exportRecord)
  };
};

const removeExportFile = async ({ tx, exportRecord }) => {
  if (!exportRecord.fileId || !exportRecord.file) {
    return;
  }

  await deleteStoredObject(exportRecord.file.storedName);
  await tx.file.delete({
    where: {
      id: exportRecord.file.id
    }
  });
};

const retryExport = async ({ id, user, ipAddress }) => {
  await expireOldExports();
  const exportRecord = await getExportById(id);
  ensureExportAccess(user, exportRecord);

  const apiStatus = getApiStatus(exportRecord);
  if (!["failed", "expired"].includes(apiStatus)) {
    throw new AppError("Only failed or expired exports can be retried.", 409, "EXPORT_RETRY_NOT_ALLOWED");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.export.findUnique({
      where: {
        id: exportRecord.id
      },
      include: exportInclude
    });

    const saved = await tx.export.update({
      where: {
        id: exportRecord.id
      },
      data: {
        status: "pending",
        fileId: null,
        errorMsg: null,
        createdAt: new Date()
      },
      include: exportInclude
    });

    await removeExportFile({ tx, exportRecord });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "UPDATE",
      tableName: "exports",
      recordId: saved.id,
      oldData: current,
      newData: saved,
      ipAddress
    });

    return saved;
  });

  await enqueueExportJob({
    exportId: updated.id
  });

  return {
    data: serializeExport(updated)
  };
};

const getExportDownloadPayload = async ({ id, user }) => {
  await expireOldExports();
  const exportRecord = await getExportById(id);
  ensureExportAccess(user, exportRecord);

  if (getApiStatus(exportRecord) === "expired") {
    throw new AppError(EXPIRED_EXPORT_MESSAGE, 410, "EXPORT_EXPIRED");
  }

  if (getApiStatus(exportRecord) !== "completed") {
    throw new AppError("Export file is not ready yet.", 409, "EXPORT_NOT_READY");
  }

  if (!exportRecord.fileId || !exportRecord.file) {
    throw new AppError(
      exportRecord.errorMsg || "Export file is no longer available.",
      410,
      "EXPORT_FILE_UNAVAILABLE"
    );
  }

  return {
    data: {
      export: exportRecord,
      file: exportRecord.file
    }
  };
};

module.exports = {
  createExport,
  getExportDetail,
  getExportDownloadPayload,
  listExports,
  retryExport,
  serializeExport
};
