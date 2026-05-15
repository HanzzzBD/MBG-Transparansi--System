const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { assertSchoolOwnership } = require("../../utils/ownership");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");

const prisma = getPrismaClient();

const buildSchoolWhere = (query = {}) => ({
  deletedAt: null,
  sppg: {
    deletedAt: null
  },
  ...(query.province ? { province: { contains: query.province, mode: "insensitive" } } : {}),
  ...(query.city ? { city: { contains: query.city, mode: "insensitive" } } : {}),
  ...(query.sppgId ? { sppgId: Number(query.sppgId) } : {})
});

const getActiveSppg = async (id) => {
  const sppg = await prisma.sppg.findFirst({
    where: {
      id: Number(id),
      deletedAt: null
    },
    select: {
      id: true
    }
  });

  if (!sppg) {
    throw new AppError("SPPG not found.", 404, "SPPG_NOT_FOUND");
  }

  return sppg;
};

const getActiveSchoolById = async (id) => {
  const school = await prisma.school.findFirst({
    where: {
      id: Number(id),
      deletedAt: null,
      sppg: {
        deletedAt: null
      }
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

const listSchools = async ({ query }) => {
  const pagination = parsePagination(query);
  const where = buildSchoolWhere(query);

  const [items, total] = await Promise.all([
    prisma.school.findMany({
      where,
      include: {
        sppg: true
      },
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ province: "asc" }, { city: "asc" }, { name: "asc" }]
    }),
    prisma.school.count({ where })
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

const getSchoolDetail = async ({ id, user }) => {
  const school = await getActiveSchoolById(id);

  if (user.role === "sekolah") {
    assertSchoolOwnership(user, school.id);
  }

  return {
    data: school
  };
};

const createSchool = async ({ payload, actorUserId, ipAddress }) => {
  await getActiveSppg(payload.sppgId);

  const school = await prisma.$transaction(async (tx) => {
    const created = await tx.school.create({
      data: {
        name: payload.name.trim(),
        province: payload.province.trim(),
        city: payload.city.trim(),
        address: payload.address ?? null,
        sppgId: payload.sppgId,
        totalStudents: payload.totalStudents ?? 0
      },
      include: {
        sppg: true
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "INSERT",
      tableName: "schools",
      recordId: created.id,
      newData: created,
      ipAddress
    });

    return created;
  });

  return {
    data: school
  };
};

const updateSchool = async ({ id, payload, actorUserId, ipAddress }) => {
  const existing = await getActiveSchoolById(id);

  if (payload.sppgId !== undefined) {
    await getActiveSppg(payload.sppgId);
  }

  const updateData = {
    ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
    ...(payload.province !== undefined ? { province: payload.province.trim() } : {}),
    ...(payload.city !== undefined ? { city: payload.city.trim() } : {}),
    ...(payload.address !== undefined ? { address: payload.address } : {}),
    ...(payload.sppgId !== undefined ? { sppgId: payload.sppgId } : {}),
    ...(payload.totalStudents !== undefined ? { totalStudents: payload.totalStudents } : {})
  };

  const school = await prisma.$transaction(async (tx) => {
    const updated = await tx.school.update({
      where: {
        id: existing.id
      },
      data: updateData,
      include: {
        sppg: true
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "UPDATE",
      tableName: "schools",
      recordId: updated.id,
      oldData: existing,
      newData: updated,
      ipAddress
    });

    return updated;
  });

  return {
    data: school
  };
};

const deleteSchool = async ({ id, actorUserId, ipAddress }) => {
  const existing = await getActiveSchoolById(id);

  const school = await prisma.$transaction(async (tx) => {
    const updated = await tx.school.update({
      where: {
        id: existing.id
      },
      data: {
        deletedAt: new Date()
      },
      include: {
        sppg: true
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "DELETE",
      tableName: "schools",
      recordId: updated.id,
      oldData: existing,
      newData: updated,
      ipAddress
    });

    return updated;
  });

  return {
    data: school
  };
};

module.exports = {
  createSchool,
  deleteSchool,
  getSchoolDetail,
  listSchools,
  updateSchool
};
