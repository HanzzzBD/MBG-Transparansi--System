const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { shouldSilentlyRejectHoneypot, verifyCaptchaToken } = require("../../utils/captcha");
const { assertSchoolOwnership, requireSchoolScope } = require("../../utils/ownership");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");

const prisma = getPrismaClient();

const publicReportInclude = {
  follower: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  }
};

const publicReportStatusValues = ["baru", "ditinjau", "ditindak", "ditutup"];
const publicReportCategoryValues = ["kualitas_makanan", "keterlambatan", "kekurangan_porsi", "lainnya"];
const publicReportStatuses = new Set(publicReportStatusValues);

const parseStatusFilter = (status) => {
  if (!status) return [];

  return String(status)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => publicReportStatuses.has(item));
};

const parseDateBoundary = (value, endOfDay = false) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  }

  return date;
};

const buildPublicReportWhere = (query = {}) => {
  const statusFilter = parseStatusFilter(query.status);
  const dateFrom = parseDateBoundary(query.dateFrom);
  const dateTo = parseDateBoundary(query.dateTo, true);

  return {
    ...(query.category ? { category: query.category } : {}),
    ...(query.province ? { province: { contains: query.province, mode: "insensitive" } } : {}),
    ...(query.city ? { city: { contains: query.city, mode: "insensitive" } } : {}),
    ...(statusFilter.length > 0 ? { status: { in: statusFilter } } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {})
          }
        }
      : {})
  };
};

const normalizePublicReportQuery = (query = {}) => ({
  ...query,
  dateFrom: query.dateFrom || query.start_date,
  dateTo: query.dateTo || query.end_date
});

const withoutDateFilters = (query = {}) => {
  const { dateFrom, dateTo, start_date: startDate, end_date: endDate, ...rest } = query;
  return rest;
};

const toDateKey = (value) => value.toISOString().slice(0, 10);

const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  return { start, end };
};

const emptyCountMap = (keys) =>
  keys.reduce((result, key) => {
    result[key] = 0;
    return result;
  }, {});

const groupRowsToCountMap = ({ rows, keyField, allowedKeys }) => {
  const counts = emptyCountMap(allowedKeys);

  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(counts, row[keyField])) {
      counts[row[keyField]] = row._count._all;
    }
  }

  return counts;
};

const serializePublicReport = (report) => {
  if (!report) return null;

  const { follower, ...data } = report;
  const followedUpByUser = follower
    ? {
        id: follower.id,
        name: follower.name,
        email: follower.email,
        role: follower.role
      }
    : null;

  return {
    ...data,
    status: data.status ?? "baru",
    followUpNote: data.followUpNote ?? null,
    follow_up_note: data.followUpNote ?? null,
    followedUpBy: data.followedUpBy ?? null,
    followed_up_by: data.followedUpBy ?? null,
    followedUpAt: data.followedUpAt ?? null,
    followed_up_at: data.followedUpAt ?? null,
    followedUpByUser,
    followed_up_by_user: followedUpByUser,
    updatedBy: followedUpByUser?.name ?? data.followedUpBy ?? null,
    updated_at: data.followedUpAt ?? null,
    updatedAt: data.followedUpAt ?? null
  };
};

const getActiveSchool = async (id) => {
  const school = await prisma.school.findFirst({
    where: {
      id: Number(id),
      deletedAt: null
    },
    include: {
      sppg: true
    }
  });

  if (!school) {
    throw new AppError("School not found.", 404, "SCHOOL_NOT_FOUND");
  }

  return school;
};

const listPublicReports = async ({ query }) => {
  const pagination = parsePagination(query);
  const where = buildPublicReportWhere(query);

  const [items, total] = await Promise.all([
    prisma.publicReport.findMany({
      where,
      include: publicReportInclude,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.publicReport.count({ where })
  ]);

  return {
    data: items.map(serializePublicReport),
    meta: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total
    })
  };
};

const getPublicReportsSummary = async ({ query = {} } = {}) => {
  const normalizedQuery = normalizePublicReportQuery(query);
  const where = buildPublicReportWhere(normalizedQuery);
  const baseWhere = buildPublicReportWhere(withoutDateFilters(normalizedQuery));
  const currentMonthRange = getCurrentMonthRange();

  const [totalReports, thisMonth, needFollowUp, statusRows, categoryRows] = await Promise.all([
    prisma.publicReport.count({ where }),
    prisma.publicReport.count({
      where: {
        ...baseWhere,
        createdAt: {
          gte: currentMonthRange.start,
          lte: currentMonthRange.end
        }
      }
    }),
    prisma.publicReport.count({
      where: {
        ...where,
        status: {
          in: ["baru", "ditinjau"]
        }
      }
    }),
    prisma.publicReport.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true
      }
    }),
    prisma.publicReport.groupBy({
      by: ["category"],
      where,
      _count: {
        _all: true
      }
    })
  ]);

  const byStatus = groupRowsToCountMap({
    rows: statusRows,
    keyField: "status",
    allowedKeys: publicReportStatusValues
  });
  const byCategory = groupRowsToCountMap({
    rows: categoryRows,
    keyField: "category",
    allowedKeys: publicReportCategoryValues
  });
  const openReports = byStatus.baru + byStatus.ditinjau;
  const resolvedReports = byStatus.ditindak;
  const closedReports = byStatus.ditutup;

  return {
    data: {
      totalReports,
      total_reports: totalReports,
      thisMonth,
      this_month: thisMonth,
      needFollowUp,
      need_follow_up: needFollowUp,
      openReports,
      open_reports: openReports,
      pendingReports: openReports,
      pending_reports: openReports,
      resolvedReports,
      resolved_reports: resolvedReports,
      closedReports,
      closed_reports: closedReports,
      rejectedReports: 0,
      rejected_reports: 0,
      byStatus,
      by_status: byStatus,
      byCategory,
      by_category: byCategory
    }
  };
};

const getPublicReportsTrend = async ({ query = {} } = {}) => {
  const where = buildPublicReportWhere(normalizePublicReportQuery(query));
  const rows = await prisma.publicReport.findMany({
    where,
    select: {
      category: true,
      createdAt: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  const buckets = new Map();

  for (const row of rows) {
    const date = toDateKey(row.createdAt);
    const current = buckets.get(date) || {
      date,
      ...emptyCountMap(publicReportCategoryValues),
      totalReports: 0,
      total_reports: 0
    };

    if (Object.prototype.hasOwnProperty.call(current, row.category)) {
      current[row.category] += 1;
    }

    current.totalReports += 1;
    current.total_reports += 1;
    buckets.set(date, current);
  }

  return {
    data: Array.from(buckets.values())
  };
};

const getPublicReportsTopRegions = async ({ query = {}, limit = 10 } = {}) => {
  const where = buildPublicReportWhere(normalizePublicReportQuery(query));
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const rows = await prisma.publicReport.findMany({
    where,
    select: {
      province: true,
      city: true
    }
  });

  const regionMap = new Map();

  for (const row of rows) {
    if (!row.province && !row.city) {
      continue;
    }

    const province = row.province || "-";
    const city = row.city || "-";
    const key = `${province}||${city}`;
    const current = regionMap.get(key) || {
      province,
      city,
      totalReports: 0,
      total_reports: 0,
      total: 0
    };

    current.totalReports += 1;
    current.total_reports += 1;
    current.total += 1;
    regionMap.set(key, current);
  }

  return {
    data: Array.from(regionMap.values())
      .sort(
        (first, second) =>
          second.totalReports - first.totalReports ||
          first.province.localeCompare(second.province) ||
          first.city.localeCompare(second.city)
      )
      .slice(0, safeLimit),
    meta: {
      limit: safeLimit
    }
  };
};

const getPublicReportDetail = async ({ id }) => {
  const report = await prisma.publicReport.findUnique({
    where: {
      id: Number(id)
    },
    include: publicReportInclude
  });

  if (!report) {
    throw new AppError("Public report not found.", 404, "PUBLIC_REPORT_NOT_FOUND");
  }

  return {
    data: serializePublicReport(report)
  };
};

const createPublicReport = async ({ payload, ipAddress }) => {
  if (shouldSilentlyRejectHoneypot(payload.hpField)) {
    return {
      data: {
        accepted: true,
        message: "Report submitted."
      },
      statusCode: 200
    };
  }

  await verifyCaptchaToken(payload.captchaToken, ipAddress);

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.publicReport.create({
      data: {
        reporterName: payload.reporterName ?? null,
        category: payload.category,
        message: payload.message.trim(),
        province: payload.province ?? null,
        city: payload.city ?? null
      },
      include: publicReportInclude
    });

    await createAuditLog({
      prisma: tx,
      action: "INSERT",
      tableName: "public_reports",
      recordId: created.id,
      newData: created,
      ipAddress
    });

    return created;
  });

  return {
    data: serializePublicReport(report),
    statusCode: 201
  };
};

const updatePublicReportStatus = async ({ id, payload, user, ipAddress }) => {
  const reportId = Number(id);
  const existing = await prisma.publicReport.findUnique({
    where: {
      id: reportId
    },
    include: publicReportInclude
  });

  if (!existing) {
    throw new AppError("Public report not found.", 404, "PUBLIC_REPORT_NOT_FOUND");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.publicReport.update({
      where: {
        id: reportId
      },
      data: {
        status: payload.status,
        followUpNote: payload.followUpNote,
        followedUpBy: user.userId,
        followedUpAt: new Date()
      },
      include: publicReportInclude
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "UPDATE",
      tableName: "public_reports",
      recordId: saved.id,
      oldData: serializePublicReport(existing),
      newData: serializePublicReport(saved),
      ipAddress
    });

    return saved;
  });

  return {
    data: serializePublicReport(updated)
  };
};

const listSchoolReports = async ({ query, user }) => {
  const pagination = parsePagination(query);
  const where = {
    school: {
      deletedAt: null
    },
    ...(query.category ? { category: query.category } : {})
  };

  if (user.role === "sekolah") {
    where.schoolId = requireSchoolScope(user);
  } else if (query.schoolId) {
    where.schoolId = Number(query.schoolId);
  }

  const [items, total] = await Promise.all([
    prisma.schoolReport.findMany({
      where,
      include: {
        school: {
          include: {
            sppg: true
          }
        },
        reporter: {
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
    prisma.schoolReport.count({ where })
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

const createSchoolReport = async ({ payload, user, ipAddress }) => {
  const targetSchoolId = user.role === "sekolah" ? requireSchoolScope(user) : payload.schoolId;

  if (!targetSchoolId) {
    throw new AppError("schoolId is required.", 400, "SCHOOL_ID_REQUIRED");
  }

  if (user.role === "sekolah") {
    assertSchoolOwnership(user, targetSchoolId);
  }

  await getActiveSchool(targetSchoolId);

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.schoolReport.create({
      data: {
        schoolId: targetSchoolId,
        reportedBy: user.userId,
        category: payload.category,
        message: payload.message.trim()
      },
      include: {
        school: {
          include: {
            sppg: true
          }
        }
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "INSERT",
      tableName: "school_reports",
      recordId: created.id,
      newData: created,
      ipAddress
    });

    return created;
  });

  return {
    data: report
  };
};

module.exports = {
  createPublicReport,
  createSchoolReport,
  getPublicReportDetail,
  getPublicReportsSummary,
  getPublicReportsTopRegions,
  getPublicReportsTrend,
  listPublicReports,
  listSchoolReports,
  updatePublicReportStatus
};
