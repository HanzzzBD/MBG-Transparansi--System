const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { shouldSilentlyRejectHoneypot, verifyCaptchaToken } = require("../../utils/captcha");
const { assertSchoolOwnership, requireSchoolScope } = require("../../utils/ownership");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");

const prisma = getPrismaClient();

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
  const where = {
    ...(query.category ? { category: query.category } : {}),
    ...(query.province ? { province: { contains: query.province, mode: "insensitive" } } : {}),
    ...(query.city ? { city: { contains: query.city, mode: "insensitive" } } : {})
  };

  const [items, total] = await Promise.all([
    prisma.publicReport.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.publicReport.count({ where })
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
      }
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
    data: report,
    statusCode: 201
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
  listPublicReports,
  listSchoolReports
};
