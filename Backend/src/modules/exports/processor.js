const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");

const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { endOfDayUtc, startOfDayUtc } = require("../../utils/date");
const { getNumberSystemConfig } = require("../../utils/systemConfig");
const {
  createStoredName,
  deleteStoredObject,
  getFileExtensionFromMimeType,
  uploadBufferToStorage
} = require("../../utils/storage");

const prisma = getPrismaClient();

const DEFAULT_EXPORT_MAX_ROWS = 50000;
const EXPORT_RETENTION_DAYS = 7;
const EXPIRED_EXPORT_MESSAGE = "Export file expired after the 7-day retention window.";

const sanitizeErrorMessage = (error) => {
  if (!error) {
    return "Unknown export error.";
  }

  if (error instanceof AppError) {
    return error.message;
  }

  return error.message || "Unknown export error.";
};

const buildDistributionWhere = (filters = {}) => {
  const where = {
    sppg: {
      deletedAt: null,
      ...(filters.province
        ? {
            province: {
              contains: filters.province,
              mode: "insensitive"
            }
          }
        : {}),
      ...(filters.city
        ? {
            city: {
              contains: filters.city,
              mode: "insensitive"
            }
          }
        : {})
    },
    school: {
      deletedAt: null
    }
  };

  if (filters.date) {
    where.distributionDate = new Date(filters.date);
  } else if (filters.start_date || filters.end_date) {
    where.distributionDate = {
      ...(filters.start_date ? { gte: startOfDayUtc(filters.start_date) } : {}),
      ...(filters.end_date ? { lte: endOfDayUtc(filters.end_date) } : {})
    };
  }

  if (filters.sppgId) {
    where.sppgId = Number(filters.sppgId);
  }

  if (filters.schoolId) {
    where.schoolId = Number(filters.schoolId);
  }

  if (filters.status) {
    where.status = filters.status;
  }

  return where;
};

const serializeDistributionRow = (distribution) => ({
  distribution_id: distribution.id,
  distribution_date: distribution.distributionDate.toISOString().slice(0, 10),
  status: distribution.status,
  portions: distribution.portions,
  received_portions: distribution.validation?.receivedPortions ?? null,
  validation_status: distribution.validation?.status ?? "pending",
  quality_ok:
    distribution.validation?.qualityOk === null || distribution.validation?.qualityOk === undefined
      ? null
      : distribution.validation.qualityOk,
  price_per_portion: Number(distribution.pricePerPortion),
  total_cost: Number(distribution.totalCost),
  sppg_name: distribution.sppg.name,
  sppg_province: distribution.sppg.province,
  sppg_city: distribution.sppg.city,
  school_name: distribution.school.name,
  school_province: distribution.school.province,
  school_city: distribution.school.city,
  failure_reason: distribution.failureReason ?? null,
  created_at: distribution.createdAt.toISOString(),
  updated_at: distribution.updatedAt.toISOString()
});

const resolveConfiguredMaxRows = async () =>
  getNumberSystemConfig(prisma, "export_max_rows", DEFAULT_EXPORT_MAX_ROWS);

const generateExcelBuffer = (rows) => {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Distributions");

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer"
  });
};

const generatePdfBuffer = async ({ rows, filters }) =>
  new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      margin: 36
    });
    const chunks = [];

    document.on("data", (chunk) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    document.fontSize(16).text("MBG Distribution Export", {
      align: "left"
    });
    document.moveDown(0.5);
    document.fontSize(10).text(`Generated at: ${new Date().toISOString()}`);
    document.text(`Filters: ${JSON.stringify(filters || {})}`);
    document.text(`Total rows: ${rows.length}`);
    document.moveDown();

    rows.forEach((row, index) => {
      const line = [
        `#${index + 1}`,
        `Dist:${row.distribution_id}`,
        `Date:${row.distribution_date}`,
        `Status:${row.status}`,
        `SPPG:${row.sppg_name}`,
        `School:${row.school_name}`,
        `Portions:${row.portions}`,
        `Received:${row.received_portions ?? "-"}`,
        `Price:${row.price_per_portion}`,
        `Total:${row.total_cost}`
      ].join(" | ");

      document.fontSize(8).text(line, {
        width: 520
      });

      if (row.failure_reason) {
        document.fontSize(7).fillColor("red").text(`Failure reason: ${row.failure_reason}`, {
          width: 520
        });
        document.fillColor("black");
      }

      document.moveDown(0.2);
    });

    document.end();
  });

const generateExportArtifact = async ({ type, rows, filters }) => {
  if (type === "excel") {
    return {
      buffer: generateExcelBuffer(rows),
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: getFileExtensionFromMimeType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xlsx"
      )
    };
  }

  return {
    buffer: await generatePdfBuffer({ rows, filters }),
    mimeType: "application/pdf",
    extension: getFileExtensionFromMimeType("application/pdf", ".pdf")
  };
};

const getExportById = async (id) => {
  const exportRecord = await prisma.export.findUnique({
    where: {
      id: Number(id)
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      },
      file: true
    }
  });

  if (!exportRecord) {
    throw new AppError("Export record not found.", 404, "EXPORT_NOT_FOUND");
  }

  return exportRecord;
};

const processExportJob = async ({ exportId }) => {
  const exportRecord = await getExportById(exportId);

  if (!["pending", "processing"].includes(exportRecord.status)) {
    return exportRecord;
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.export.findUnique({
      where: {
        id: exportRecord.id
      }
    });

    await tx.export.update({
      where: {
        id: exportRecord.id
      },
      data: {
        status: "processing",
        errorMsg: null
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: exportRecord.userId,
      action: "UPDATE",
      tableName: "exports",
      recordId: exportRecord.id,
      oldData: current,
      newData: {
        status: "processing"
      }
    });
  });

  try {
    const filters = exportRecord.filterParams && typeof exportRecord.filterParams === "object" ? exportRecord.filterParams : {};
    const where = buildDistributionWhere(filters);
    const maxRows = await resolveConfiguredMaxRows();
    const totalRows = await prisma.distribution.count({ where });

    if (totalRows > maxRows) {
      throw new AppError(
        `Export exceeds the maximum allowed rows (${maxRows}).`,
        400,
        "EXPORT_MAX_ROWS_EXCEEDED"
      );
    }

    const distributions = await prisma.distribution.findMany({
      where,
      include: {
        sppg: true,
        school: true,
        validation: true
      },
      orderBy: [{ distributionDate: "desc" }, { createdAt: "desc" }]
    });

    const rows = distributions.map(serializeDistributionRow);
    const artifact = await generateExportArtifact({
      type: exportRecord.type,
      rows,
      filters
    });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const storedName = createStoredName({
      category: "exports",
      extension: artifact.extension
    });
    const originalName = `mbg-export-${timestamp}${artifact.extension}`;

    const uploaded = await uploadBufferToStorage({
      storedName,
      buffer: artifact.buffer,
      mimeType: artifact.mimeType
    });

    await prisma.$transaction(async (tx) => {
      const file = await tx.file.create({
        data: {
          originalName,
          storedName: uploaded.storedName,
          fileUrl: uploaded.fileUrl,
          mimeType: artifact.mimeType,
          sizeBytes: artifact.buffer.length,
          uploadedBy: exportRecord.userId,
          status: "ready"
        }
      });

      const current = await tx.export.findUnique({
        where: {
          id: exportRecord.id
        }
      });

      const updatedExport = await tx.export.update({
        where: {
          id: exportRecord.id
        },
        data: {
          status: "done",
          fileId: file.id,
          errorMsg: null
        }
      });

      await createAuditLog({
        prisma: tx,
        userId: exportRecord.userId,
        action: "INSERT",
        tableName: "files",
        recordId: file.id,
        newData: file
      });

      await createAuditLog({
        prisma: tx,
        userId: exportRecord.userId,
        action: "UPDATE",
        tableName: "exports",
        recordId: updatedExport.id,
        oldData: current,
        newData: updatedExport
      });
    });

    return getExportById(exportRecord.id);
  } catch (error) {
    const errorMessage = sanitizeErrorMessage(error);

    await prisma.$transaction(async (tx) => {
      const current = await tx.export.findUnique({
        where: {
          id: exportRecord.id
        }
      });

      const failedExport = await tx.export.update({
        where: {
          id: exportRecord.id
        },
        data: {
          status: "failed",
          errorMsg: errorMessage
        }
      });

      await createAuditLog({
        prisma: tx,
        userId: exportRecord.userId,
        action: "UPDATE",
        tableName: "exports",
        recordId: failedExport.id,
        oldData: current,
        newData: failedExport
      });
    });

    throw error;
  }
};

const cleanupExpiredExports = async () => {
  const cutoffDate = new Date(Date.now() - EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const expiredExports = await prisma.export.findMany({
    where: {
      status: "done",
      fileId: {
        not: null
      },
      createdAt: {
        lt: cutoffDate
      }
    },
    include: {
      file: true
    }
  });

  for (const exportRecord of expiredExports) {
    if (!exportRecord.file) {
      continue;
    }

    try {
      await deleteStoredObject(exportRecord.file.storedName);
    } catch (error) {
      if (error && error.code !== "ENOENT") {
        console.error("Failed to delete expired export object:", error);
        continue;
      }
    }

    await prisma.$transaction(async (tx) => {
      const currentExport = await tx.export.findUnique({
        where: {
          id: exportRecord.id
        }
      });

      await tx.export.update({
        where: {
          id: exportRecord.id
        },
        data: {
          fileId: null,
          errorMsg: EXPIRED_EXPORT_MESSAGE
        }
      });

      await tx.file.delete({
        where: {
          id: exportRecord.file.id
        }
      });

      await createAuditLog({
        prisma: tx,
        action: "UPDATE",
        tableName: "exports",
        recordId: exportRecord.id,
        oldData: currentExport,
        newData: {
          fileId: null,
          errorMsg: EXPIRED_EXPORT_MESSAGE
        }
      });

      await createAuditLog({
        prisma: tx,
        action: "DELETE",
        tableName: "files",
        recordId: exportRecord.file.id,
        oldData: exportRecord.file,
        newData: null
      });
    });
  }

  return expiredExports.length;
};

module.exports = {
  EXPIRED_EXPORT_MESSAGE,
  cleanupExpiredExports,
  processExportJob
};
