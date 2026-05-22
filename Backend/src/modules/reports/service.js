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

const publicReportStatuses = new Set(["baru", "ditinjau", "ditindak", "ditutup"]);

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
  listPublicReports,
  listSchoolReports,
  updatePublicReportStatus
};
