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
const { assertExportDatasetsAllowed } = require("./datasets");

const prisma = getPrismaClient();

const DEFAULT_EXPORT_MAX_ROWS = 50000;
const EXPORT_RETENTION_DAYS = 7;
const EXPIRED_EXPORT_MESSAGE = "Export file expired after the 7-day retention window.";

const DATASET_LABELS = {
  distributions: "Data Distribusi",
  validations: "Validasi Sekolah",
  public_reports: "Laporan Masyarakat",
  budget_by_region: "Anggaran per Wilayah",
  audit_logs: "Audit Log",
  anomalies: "Anomali Terdeteksi",
  production_batches: "Production Batch & Costing",
  food_prices: "Food Prices SP2KP"
};

const toNumber = (value) => (value === null || value === undefined ? null : Number(value));

const toIsoString = (value) => (value ? new Date(value).toISOString() : null);

const toDateString = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);

const asArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
};

const ensureValidDateFilter = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError("Invalid export date filter.", 400, "EXPORT_FILTER_DATE_INVALID");
  }

  return value;
};

const getDateRange = (filters = {}) => {
  const exactDate = ensureValidDateFilter(filters.date);
  const startDate = ensureValidDateFilter(filters.start_date || filters.dateFrom || filters.date_from);
  const endDate = ensureValidDateFilter(filters.end_date || filters.dateTo || filters.date_to);

  if (exactDate) {
    return {
      gte: startOfDayUtc(exactDate),
      lte: endOfDayUtc(exactDate)
    };
  }

  if (!startDate && !endDate) {
    return null;
  }

  return {
    ...(startDate ? { gte: startOfDayUtc(startDate) } : {}),
    ...(endDate ? { lte: endOfDayUtc(endDate) } : {})
  };
};

const getLocationFilters = (filters = {}) => {
  const provinceList = [
    ...asArray(filters.province),
    ...asArray(filters.provinceList),
    ...asArray(filters.province_list),
    ...asArray(filters.provinces)
  ];
  const cityList = [...asArray(filters.city), ...asArray(filters.cities)];

  return {
    provinces: [...new Set(provinceList)],
    cities: [...new Set(cityList)]
  };
};

const buildTextFilter = (values) => {
  if (!values.length) {
    return undefined;
  }

  if (values.length === 1) {
    return {
      contains: values[0],
      mode: "insensitive"
    };
  }

  return {
    in: values
  };
};

const buildLocationWhere = (filters = {}) => {
  const { provinces, cities } = getLocationFilters(filters);
  return {
    ...(buildTextFilter(provinces) ? { province: buildTextFilter(provinces) } : {}),
    ...(buildTextFilter(cities) ? { city: buildTextFilter(cities) } : {})
  };
};

const assertRowsWithinLimit = ({ datasetId, nextTotal, maxRows }) => {
  if (nextTotal > maxRows) {
    throw new AppError(
      `Export exceeds the maximum allowed rows (${maxRows}) after adding ${DATASET_LABELS[datasetId] || datasetId}.`,
      400,
      "EXPORT_MAX_ROWS_EXCEEDED"
    );
  }
};

const sanitizeErrorMessage = (error) => {
  if (!error) {
    return "Unknown export error.";
  }

  if (error instanceof AppError) {
    return error.message;
  }

  if (error.name?.startsWith("Prisma") || error.message?.includes("Invalid `prisma.")) {
    return "Export failed while reading data from the database.";
  }

  return error.message || "Unknown export error.";
};

const buildDistributionWhere = (filters = {}) => {
  const dateRange = getDateRange(filters);
  const locationWhere = buildLocationWhere(filters);
  const where = {
    sppg: {
      deletedAt: null,
      ...locationWhere
    },
    school: {
      deletedAt: null
    }
  };

  if (dateRange) {
    where.distributionDate = dateRange;
  }

  if (filters.sppgId) {
    where.sppgId = Number(filters.sppgId);
  }

  if (filters.schoolId) {
    where.schoolId = Number(filters.schoolId);
  }

  const statuses = [
    ...asArray(filters.status),
    ...asArray(filters.distributionStatus),
    ...asArray(filters.distributionStatuses),
    ...asArray(filters.distribution_statuses)
  ];

  if (statuses.length === 1) {
    where.status = statuses[0];
  } else if (statuses.length > 1) {
    where.status = {
      in: statuses
    };
  }

  return where;
};

const serializeDistributionRow = (distribution) => ({
  distribution_id: distribution.id,
  distribution_date: toDateString(distribution.distributionDate),
  status: distribution.status,
  delivery_status: distribution.status,
  confirmation_status: distribution.validation?.status ?? "pending",
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
  created_at: toIsoString(distribution.createdAt),
  updated_at: toIsoString(distribution.updatedAt)
});

const serializeValidationRow = (validation) => ({
  validation_id: validation.id,
  distribution_id: validation.distributionId,
  distribution_date: toDateString(validation.distribution?.distributionDate),
  school_name: validation.school?.name ?? validation.distribution?.school?.name ?? null,
  school_province: validation.school?.province ?? validation.distribution?.school?.province ?? null,
  school_city: validation.school?.city ?? validation.distribution?.school?.city ?? null,
  sppg_name: validation.distribution?.sppg?.name ?? null,
  sppg_province: validation.distribution?.sppg?.province ?? null,
  sppg_city: validation.distribution?.sppg?.city ?? null,
  received_portions: validation.receivedPortions,
  quality_ok: validation.qualityOk,
  status: validation.status,
  notes: validation.notes ?? null,
  validated_at: toIsoString(validation.validatedAt),
  created_at: toIsoString(validation.createdAt),
  updated_at: toIsoString(validation.updatedAt)
});

const serializePublicReportRow = (report) => ({
  report_id: report.id,
  reporter_name: report.reporterName ?? null,
  category: report.category,
  status: report.status,
  province: report.province ?? null,
  city: report.city ?? null,
  message: report.message,
  follow_up_note: report.followUpNote ?? null,
  followed_up_by: report.follower?.name ?? report.followedUpBy ?? null,
  followed_up_at: toIsoString(report.followedUpAt),
  created_at: toIsoString(report.createdAt)
});

const serializeAuditLogRow = (log) => ({
  audit_log_id: log.id,
  action: log.action,
  table_name: log.tableName,
  record_id: log.recordId,
  user_id: log.userId ?? null,
  user_name: log.user?.name ?? null,
  user_role: log.user?.role ?? null,
  ip_address: log.ipAddress ?? null,
  created_at: toIsoString(log.createdAt)
});

const serializeAnomalyRow = (anomaly) => ({
  anomaly_id: anomaly.id,
  anomaly_type: anomaly.anomalyType,
  description: anomaly.description,
  is_resolved: anomaly.isResolved,
  distribution_id: anomaly.distributionId ?? null,
  production_batch_id: anomaly.productionBatchId ?? null,
  sppg_name: anomaly.distribution?.sppg?.name ?? anomaly.productionBatch?.sppg?.name ?? null,
  sppg_province: anomaly.distribution?.sppg?.province ?? anomaly.productionBatch?.sppg?.province ?? null,
  sppg_city: anomaly.distribution?.sppg?.city ?? anomaly.productionBatch?.sppg?.city ?? null,
  school_name: anomaly.distribution?.school?.name ?? null,
  resolved_by: anomaly.resolver?.name ?? anomaly.resolvedBy ?? null,
  resolved_at: toIsoString(anomaly.resolvedAt),
  created_at: toIsoString(anomaly.createdAt)
});

const serializeProductionBatchRow = ({ batch, mode }) => {
  const base = {
    production_batch_id: batch.id,
    production_date: toDateString(batch.productionDate),
    sppg_name: batch.sppg?.name ?? null,
    sppg_province: batch.sppg?.province ?? null,
    sppg_city: batch.sppg?.city ?? null,
    menu_name: batch.menu?.menuName ?? null,
    total_portions: batch.totalPortions,
    total_cost: toNumber(batch.totalCost),
    cost_per_portion: toNumber(batch.costPerPortion),
    item_count: batch._count?.items ?? 0,
    anomaly_count: batch._count?.anomalyLogs ?? 0,
    created_at: toIsoString(batch.createdAt),
    updated_at: toIsoString(batch.updatedAt)
  };

  if (mode === "summary") {
    return base;
  }

  return {
    ...base,
    raw_material_cost: toNumber(batch.rawMaterialCost),
    operational_cost: toNumber(batch.operationalCost),
    packaging_cost: toNumber(batch.packagingCost),
    distribution_cost: toNumber(batch.distributionCost),
    rent_cost: toNumber(batch.rentCost),
    notes: batch.notes ?? null
  };
};

const serializeFoodPriceRow = (price) => ({
  food_price_id: price.id,
  date: toDateString(price.date),
  source: price.source,
  scope: price.scope,
  level: price.level ?? null,
  province: price.province ?? null,
  city: price.city ?? null,
  variant_id: price.variantId,
  variant: price.variant,
  unit: price.unit,
  quantity: price.quantity,
  price: toNumber(price.price),
  source_endpoint: price.sourceEndpoint ?? null,
  created_at: toIsoString(price.createdAt),
  updated_at: toIsoString(price.updatedAt)
});

const createSection = ({ datasetId, rows }) => ({
  datasetId,
  label: DATASET_LABELS[datasetId] || datasetId,
  rows
});

const buildDistributionSection = async ({ filters, currentTotal, maxRows }) => {
  const datasetId = "distributions";
  const where = buildDistributionWhere(filters);
  const totalRows = await prisma.distribution.count({ where });
  assertRowsWithinLimit({ datasetId, nextTotal: currentTotal + totalRows, maxRows });

  const distributions = await prisma.distribution.findMany({
    where,
    include: {
      sppg: true,
      school: true,
      validation: true
    },
    orderBy: [{ distributionDate: "desc" }, { createdAt: "desc" }]
  });

  return createSection({
    datasetId,
    rows: distributions.map(serializeDistributionRow)
  });
};

const buildValidationWhere = (filters = {}) => {
  const dateRange = getDateRange(filters);
  const locationWhere = buildLocationWhere(filters);
  const where = {
    school: {
      deletedAt: null,
      ...locationWhere
    },
    distribution: {
      school: {
        deletedAt: null
      },
      sppg: {
        deletedAt: null
      }
    },
    ...(filters.validationStatus ? { status: filters.validationStatus } : {})
  };

  if (dateRange) {
    where.createdAt = dateRange;
  }

  return where;
};

const buildValidationSection = async ({ filters, currentTotal, maxRows }) => {
  const datasetId = "validations";
  const where = buildValidationWhere(filters);
  const totalRows = await prisma.validation.count({ where });
  assertRowsWithinLimit({ datasetId, nextTotal: currentTotal + totalRows, maxRows });

  const validations = await prisma.validation.findMany({
    where,
    include: {
      school: true,
      distribution: {
        include: {
          sppg: true,
          school: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });

  return createSection({
    datasetId,
    rows: validations.map(serializeValidationRow)
  });
};

const buildPublicReportWhere = (filters = {}) => {
  const dateRange = getDateRange(filters);
  const where = {
    ...buildLocationWhere(filters),
    ...(filters.publicReportStatus ? { status: filters.publicReportStatus } : {}),
    ...(filters.publicReportCategory ? { category: filters.publicReportCategory } : {})
  };

  if (dateRange) {
    where.createdAt = dateRange;
  }

  return where;
};

const buildPublicReportSection = async ({ filters, currentTotal, maxRows }) => {
  const datasetId = "public_reports";
  const where = buildPublicReportWhere(filters);
  const totalRows = await prisma.publicReport.count({ where });
  assertRowsWithinLimit({ datasetId, nextTotal: currentTotal + totalRows, maxRows });

  const reports = await prisma.publicReport.findMany({
    where,
    include: {
      follower: {
        select: {
          id: true,
          name: true,
          role: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });

  return createSection({
    datasetId,
    rows: reports.map(serializePublicReportRow)
  });
};

const buildBudgetByRegionSection = async ({ filters, currentTotal, maxRows }) => {
  const datasetId = "budget_by_region";
  const where = buildDistributionWhere(filters);
  const sourceRows = await prisma.distribution.count({ where });
  assertRowsWithinLimit({ datasetId, nextTotal: currentTotal + sourceRows, maxRows });

  const distributions = await prisma.distribution.findMany({
    where,
    select: {
      status: true,
      portions: true,
      totalCost: true,
      sppg: {
        select: {
          province: true,
          city: true
        }
      }
    }
  });
  const grouped = new Map();

  for (const distribution of distributions) {
    const province = distribution.sppg?.province || "-";
    const city = distribution.sppg?.city || "-";
    const key = `${province}::${city}`;
    const existing =
      grouped.get(key) ||
      {
        province,
        city,
        total_portions: 0,
        total_cost: 0,
        distribution_count: 0,
        delivered_count: 0,
        failed_count: 0,
        in_progress_count: 0
      };

    existing.total_portions += Number(distribution.portions || 0);
    existing.total_cost += Number(distribution.totalCost || 0);
    existing.distribution_count += 1;
    if (distribution.status === "delivered") existing.delivered_count += 1;
    if (distribution.status === "failed") existing.failed_count += 1;
    if (distribution.status === "in_progress") existing.in_progress_count += 1;
    grouped.set(key, existing);
  }

  const rows = [...grouped.values()].sort((first, second) => {
    const provinceOrder = first.province.localeCompare(second.province);
    return provinceOrder || first.city.localeCompare(second.city);
  });

  assertRowsWithinLimit({ datasetId, nextTotal: currentTotal + rows.length, maxRows });

  return createSection({
    datasetId,
    rows
  });
};

const buildAuditLogSection = async ({ filters, currentTotal, maxRows }) => {
  const datasetId = "audit_logs";
  const dateRange = getDateRange(filters);
  const where = {
    ...(dateRange ? { createdAt: dateRange } : {}),
    ...(filters.auditTableName ? { tableName: filters.auditTableName } : {}),
    ...(filters.auditAction ? { action: filters.auditAction } : {})
  };
  const totalRows = await prisma.auditLog.count({ where });
  assertRowsWithinLimit({ datasetId, nextTotal: currentTotal + totalRows, maxRows });

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });

  return createSection({
    datasetId,
    rows: logs.map(serializeAuditLogRow)
  });
};

const buildAnomalyWhere = (filters = {}) => {
  const dateRange = getDateRange(filters);
  const locationWhere = buildLocationWhere(filters);
  const hasLocationFilter = Object.keys(locationWhere).length > 0;
  const where = {
    ...(dateRange ? { createdAt: dateRange } : {}),
    ...(filters.anomalyStatus === "resolved" ? { isResolved: true } : {}),
    ...(filters.anomalyStatus === "unresolved" ? { isResolved: false } : {}),
    ...(hasLocationFilter
      ? {
          OR: [
            {
              distribution: {
                sppg: {
                  deletedAt: null,
                  ...locationWhere
                }
              }
            },
            {
              productionBatch: {
                sppg: {
                  deletedAt: null,
                  ...locationWhere
                }
              }
            }
          ]
        }
      : {})
  };

  return where;
};

const buildAnomalySection = async ({ filters, currentTotal, maxRows }) => {
  const datasetId = "anomalies";
  const where = buildAnomalyWhere(filters);
  const totalRows = await prisma.anomalyLog.count({ where });
  assertRowsWithinLimit({ datasetId, nextTotal: currentTotal + totalRows, maxRows });

  const anomalies = await prisma.anomalyLog.findMany({
    where,
    include: {
      distribution: {
        include: {
          sppg: true,
          school: true
        }
      },
      productionBatch: {
        include: {
          sppg: true
        }
      },
      resolver: {
        select: {
          id: true,
          name: true,
          role: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });

  return createSection({
    datasetId,
    rows: anomalies.map(serializeAnomalyRow)
  });
};

const buildProductionBatchSection = async ({ filters, user, currentTotal, maxRows }) => {
  const datasetId = "production_batches";
  const dateRange = getDateRange(filters);
  const where = {
    sppg: {
      deletedAt: null,
      ...buildLocationWhere(filters)
    },
    ...(dateRange ? { productionDate: dateRange } : {})
  };
  const totalRows = await prisma.productionBatch.count({ where });
  assertRowsWithinLimit({ datasetId, nextTotal: currentTotal + totalRows, maxRows });

  const batches = await prisma.productionBatch.findMany({
    where,
    include: {
      sppg: true,
      menu: true,
      _count: {
        select: {
          items: true,
          anomalyLogs: true
        }
      }
    },
    orderBy: [{ productionDate: "desc" }, { createdAt: "desc" }]
  });
  const datasetModes = filters.datasetModes || filters.dataset_modes || {};
  const mode = user?.role === "admin" ? datasetModes.production_batches || "detail" : "summary";

  return createSection({
    datasetId,
    rows: batches.map((batch) => serializeProductionBatchRow({ batch, mode }))
  });
};

const buildFoodPriceSection = async ({ filters, currentTotal, maxRows }) => {
  const datasetId = "food_prices";
  const dateRange = getDateRange(filters);
  const where = {
    ...buildLocationWhere(filters),
    ...(dateRange ? { date: dateRange } : {})
  };
  const totalRows = await prisma.foodPrice.count({ where });
  assertRowsWithinLimit({ datasetId, nextTotal: currentTotal + totalRows, maxRows });

  const prices = await prisma.foodPrice.findMany({
    where,
    orderBy: [{ date: "desc" }, { province: "asc" }, { city: "asc" }, { variant: "asc" }]
  });

  return createSection({
    datasetId,
    rows: prices.map(serializeFoodPriceRow)
  });
};

const DATASET_BUILDERS = {
  distributions: buildDistributionSection,
  validations: buildValidationSection,
  public_reports: buildPublicReportSection,
  budget_by_region: buildBudgetByRegionSection,
  audit_logs: buildAuditLogSection,
  anomalies: buildAnomalySection,
  production_batches: buildProductionBatchSection,
  food_prices: buildFoodPriceSection
};

const buildExportSections = async ({ datasetIds, filters, user, maxRows }) => {
  const sections = [];
  let totalRows = 0;

  for (const datasetId of datasetIds) {
    const builder = DATASET_BUILDERS[datasetId];
    const section = await builder({
      filters,
      user,
      currentTotal: totalRows,
      maxRows
    });
    totalRows += section.rows.length;
    assertRowsWithinLimit({ datasetId, nextTotal: totalRows, maxRows });
    sections.push(section);
  }

  return {
    sections,
    totalRows
  };
};

const resolveConfiguredMaxRows = async () =>
  getNumberSystemConfig(prisma, "export_max_rows", DEFAULT_EXPORT_MAX_ROWS);

const sanitizeSheetName = (value, fallback) => {
  const sanitized = String(value || fallback)
    .replace(/[\\/?*[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (sanitized || fallback).slice(0, 31);
};

const generateExcelBuffer = (sections) => {
  const workbook = XLSX.utils.book_new();

  sections.forEach((section, index) => {
    const worksheet = XLSX.utils.json_to_sheet(section.rows);
    const sheetName = sanitizeSheetName(section.label, `Dataset ${index + 1}`);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer"
  });
};

const generatePdfBuffer = async ({ sections, filters }) =>
  new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      margin: 36
    });
    const chunks = [];

    document.on("data", (chunk) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    document.fontSize(16).text("MBG Data Export", {
      align: "left"
    });
    document.moveDown(0.5);
    document.fontSize(10).text(`Generated at: ${new Date().toISOString()}`);
    document.text(`Filters: ${JSON.stringify(filters || {})}`);
    document.text(`Total rows: ${sections.reduce((total, section) => total + section.rows.length, 0)}`);
    document.moveDown();

    sections.forEach((section, sectionIndex) => {
      if (sectionIndex > 0) {
        document.addPage();
      }

      document.fontSize(13).text(section.label, {
        underline: true
      });
      document.fontSize(9).text(`Rows: ${section.rows.length}`);
      document.moveDown(0.4);

      if (!section.rows.length) {
        document.fontSize(9).text("Tidak ada data untuk filter ini.");
        document.moveDown();
        return;
      }

      section.rows.forEach((row, rowIndex) => {
        const line = Object.entries(row)
          .map(([key, value]) => `${key}: ${value === null || value === undefined ? "-" : value}`)
          .join(" | ");

        document.fontSize(7).text(`#${rowIndex + 1} ${line}`, {
          width: 520
        });
        document.moveDown(0.2);
      });
    });

    document.end();
  });

const generateExportArtifact = async ({ type, sections, filters }) => {
  if (type === "excel") {
    return {
      buffer: generateExcelBuffer(sections),
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: getFileExtensionFromMimeType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xlsx"
      )
    };
  }

  return {
    buffer: await generatePdfBuffer({ sections, filters }),
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
    const datasetIds = assertExportDatasetsAllowed({
      filterParams: filters,
      user: exportRecord.user
    });
    const maxRows = await resolveConfiguredMaxRows();
    const { sections, totalRows } = await buildExportSections({
      datasetIds,
      filters,
      user: exportRecord.user,
      maxRows
    });
    const artifact = await generateExportArtifact({
      type: exportRecord.type,
      sections,
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
          errorMsg: null,
          filterParams: {
            ...(filters || {}),
            datasets: datasetIds,
            rowCount: totalRows,
            row_count: totalRows
          }
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
