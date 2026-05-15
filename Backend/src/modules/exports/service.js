const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { enqueueExportJob } = require("./runtime");

const prisma = getPrismaClient();

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

const createExport = async ({ payload, user, ipAddress }) => {
  const exportRecord = await prisma.$transaction(async (tx) => {
    const created = await tx.export.create({
      data: {
        userId: user.userId,
        type: payload.type,
        filterParams: payload.filters || {},
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
    data: exportRecord
  };
};

const getExportDetail = async ({ id, user }) => {
  const exportRecord = await getExportById(id);
  ensureExportAccess(user, exportRecord);

  return {
    data: exportRecord
  };
};

const getExportDownloadPayload = async ({ id, user }) => {
  const exportRecord = await getExportById(id);
  ensureExportAccess(user, exportRecord);

  if (exportRecord.status !== "done") {
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
  getExportDownloadPayload
};
