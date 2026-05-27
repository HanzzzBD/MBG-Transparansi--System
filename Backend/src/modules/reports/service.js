const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { shouldSilentlyRejectHoneypot, verifyCaptchaToken } = require("../../utils/captcha");
const { assertSchoolOwnership, requireSchoolScope, requireSppgScope } = require("../../utils/ownership");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");
const { normalizeCityName, normalizeProvinceName } = require("../../utils/region");
const {
  createNotificationsForUsers,
  findUserIdsBySppgId
} = require("../../utils/notification");

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

const withoutLocationFilters = (query = {}) => {
  const { province, city, ...rest } = query;
  return rest;
};

const withoutCityFilter = (query = {}) => {
  const { city, ...rest } = query;
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

const getPublicReportFilterOptions = async (query = {}) => {
  const normalizedQuery = normalizePublicReportQuery(query);
  const [provinceRows, cityRows] = await Promise.all([
    prisma.publicReport.findMany({
      where: buildPublicReportWhere(withoutLocationFilters(normalizedQuery)),
      distinct: ["province"],
      select: {
        province: true
      },
      orderBy: {
        province: "asc"
      }
    }),
    prisma.publicReport.findMany({
      where: buildPublicReportWhere(withoutCityFilter(normalizedQuery)),
      distinct: ["province", "city"],
      select: {
        province: true,
        city: true
      },
      orderBy: [{ province: "asc" }, { city: "asc" }]
    })
  ]);

  return {
    categories: publicReportCategoryValues.map((value) => ({
      value,
      total: 0
    })),
    statuses: publicReportStatusValues.map((value) => ({
      value,
      total: 0
    })),
    provinces: provinceRows
      .map((row) => row.province)
      .filter(Boolean),
    cities: cityRows
      .filter((row) => row.city)
      .map((row) => ({
        province: row.province || null,
        city: row.city
      }))
  };
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

const schoolReportInclude = {
  school: {
    include: {
      sppg: true
    }
  },
  sppg: true,
  distribution: {
    include: {
      sppg: true,
      school: true,
      validation: true
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

  const [totalReports, thisMonth, needFollowUp, statusRows, categoryRows, filterOptions] = await Promise.all([
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
    }),
    getPublicReportFilterOptions(normalizedQuery)
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
      by_category: byCategory,
      filterOptions: {
        ...filterOptions,
        categories: filterOptions.categories.map((item) => ({
          ...item,
          total: byCategory[item.value] || 0
        })),
        statuses: filterOptions.statuses.map((item) => ({
          ...item,
          total: byStatus[item.value] || 0
        }))
      },
      filter_options: {
        ...filterOptions,
        categories: filterOptions.categories.map((item) => ({
          ...item,
          total: byCategory[item.value] || 0
        })),
        statuses: filterOptions.statuses.map((item) => ({
          ...item,
          total: byStatus[item.value] || 0
        }))
      }
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
        province: normalizeProvinceName(payload.province),
        city: normalizeCityName(payload.city)
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
  } else if (user.role === "sppg") {
    where.sppgId = requireSppgScope(user);
  } else if (query.schoolId) {
    where.schoolId = Number(query.schoolId);
  }

  if (user.role !== "sppg" && query.sppgId) {
    where.sppgId = Number(query.sppgId);
  }

  if (query.distributionId) {
    where.distributionId = Number(query.distributionId);
  }

  const [items, total] = await Promise.all([
    prisma.schoolReport.findMany({
      where,
      include: schoolReportInclude,
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

const getReportTargetFromDistribution = async ({ tx, payload, user, targetSchoolId }) => {
  if (!payload.distributionId) {
    const school = await tx.school.findFirst({
      where: {
        id: Number(targetSchoolId),
        deletedAt: null
      },
      include: {
        sppg: true
      }
    });

    if (!school) {
      throw new AppError("School not found.", 404, "SCHOOL_NOT_FOUND");
    }

    return {
      schoolId: school.id,
      sppgId: school.sppgId,
      distributionId: null,
      validation: null
    };
  }

  const distribution = await tx.distribution.findFirst({
    where: {
      id: Number(payload.distributionId),
      school: {
        deletedAt: null
      },
      sppg: {
        deletedAt: null
      }
    },
    include: {
      school: true,
      sppg: true,
      validation: true
    }
  });

  if (!distribution) {
    throw new AppError("Distribution not found.", 404, "DISTRIBUTION_NOT_FOUND");
  }

  if (user.role === "sekolah") {
    assertSchoolOwnership(user, distribution.schoolId);
  } else if (targetSchoolId && Number(targetSchoolId) !== Number(distribution.schoolId)) {
    throw new AppError("schoolId does not match the distribution school.", 400, "SCHOOL_DISTRIBUTION_MISMATCH");
  }

  if (!distribution.validation) {
    throw new AppError(
      "Distribution does not have a validation record.",
      409,
      "DISTRIBUTION_VALIDATION_NOT_FOUND"
    );
  }

  if (payload.validationId && Number(payload.validationId) !== Number(distribution.validation.id)) {
    throw new AppError("validationId does not match the distribution.", 400, "VALIDATION_DISTRIBUTION_MISMATCH");
  }

  return {
    schoolId: distribution.schoolId,
    sppgId: distribution.sppgId,
    distributionId: distribution.id,
    validation: distribution.validation
  };
};

const createSchoolReport = async ({ payload, user, ipAddress }) => {
  const targetSchoolId = user.role === "sekolah" ? requireSchoolScope(user) : payload.schoolId;

  if (!targetSchoolId && !payload.distributionId) {
    throw new AppError("schoolId is required.", 400, "SCHOOL_ID_REQUIRED");
  }

  if (user.role === "sekolah") {
    assertSchoolOwnership(user, targetSchoolId);
  }

  const report = await prisma.$transaction(async (tx) => {
    const target = await getReportTargetFromDistribution({
      tx,
      payload,
      user,
      targetSchoolId
    });

    const created = await tx.schoolReport.create({
      data: {
        schoolId: target.schoolId,
        sppgId: target.sppgId,
        distributionId: target.distributionId,
        reportedBy: user.userId,
        category: payload.category,
        message: payload.message.trim()
      },
      include: schoolReportInclude
    });
    let validationStatus = target.validation?.status ?? null;

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "INSERT",
      tableName: "school_reports",
      recordId: created.id,
      newData: created,
      ipAddress
    });

    if (target.validation && target.validation.status === "pending") {
      const updatedValidation = await tx.validation.update({
        where: {
          id: target.validation.id
        },
        data: {
          status: "issue_reported",
          notes: payload.message.trim(),
          validatedAt: new Date()
        },
        include: {
          school: true,
          distribution: {
            include: {
              sppg: true,
              school: true
            }
          }
        }
      });
      validationStatus = updatedValidation.status;

      await createAuditLog({
        prisma: tx,
        userId: user.userId,
        action: "UPDATE",
        tableName: "validations",
        recordId: updatedValidation.id,
        oldData: target.validation,
        newData: updatedValidation,
        ipAddress
      });
    }

    if (target.sppgId) {
      const sppgUserIds = await findUserIdsBySppgId(tx, target.sppgId);

      await createNotificationsForUsers({
        prisma: tx,
        userIds: sppgUserIds,
        type: "validation",
        title: "Masalah Distribusi Dilaporkan",
        message: `Sekolah melaporkan masalah pada distribusi #${target.distributionId ?? "tanpa distribusi"}.`,
        payload: {
          reportId: created.id,
          distributionId: target.distributionId,
          schoolId: target.schoolId,
          sppgId: target.sppgId,
          validationStatus
        }
      });
    }

    return tx.schoolReport.findUnique({
      where: {
        id: created.id
      },
      include: schoolReportInclude
    });
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
