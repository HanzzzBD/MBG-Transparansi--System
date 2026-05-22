const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");

const prisma = getPrismaClient();

const buildSppgWhere = (query = {}) => ({
  deletedAt: null,
  ...(query.province ? { province: { contains: query.province, mode: "insensitive" } } : {}),
  ...(query.city ? { city: { contains: query.city, mode: "insensitive" } } : {}),
  ...(query.status ? { status: query.status } : {})
});

const buildSppgSelect = (fields) => {
  if (!fields) {
    return undefined;
  }

  const requestedFields = fields
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);

  const allowedFields = new Set(["lat", "lng", "status", "province", "city", "address", "capacity"]);
  const select = {
    id: true,
    name: true
  };

  requestedFields.forEach((field) => {
    if (allowedFields.has(field)) {
      select[field] = true;
    }
  });

  return select;
};

const getActiveSppgById = async (id) => {
  const sppg = await prisma.sppg.findFirst({
    where: {
      id: Number(id),
      deletedAt: null
    }
  });

  if (!sppg) {
    throw new AppError("SPPG not found.", 404, "SPPG_NOT_FOUND");
  }

  return sppg;
};

const listSppg = async ({ query }) => {
  const pagination = query.all ? null : parsePagination(query);
  const where = buildSppgWhere(query);
  const select = buildSppgSelect(query.fields);

  const [items, total] = await Promise.all([
    prisma.sppg.findMany({
      where,
      ...(select ? { select } : {}),
      ...(pagination ? { skip: pagination.skip, take: pagination.limit } : {}),
      orderBy: [{ province: "asc" }, { city: "asc" }, { name: "asc" }]
    }),
    prisma.sppg.count({ where })
  ]);

  return {
    data: items,
    meta: pagination
      ? buildPaginationMeta({
          page: pagination.page,
          limit: pagination.limit,
          total
        })
      : {
          page: 1,
          limit: total,
          total,
          totalPages: total === 0 ? 0 : 1,
          all: true
        }
  };
};

const getSppgDetail = async ({ id }) => {
  const sppg = await prisma.sppg.findFirst({
    where: {
      id: Number(id),
      deletedAt: null
    },
    include: {
      menus: {
        where: {
          deletedAt: null
        },
        orderBy: [{ menuDate: "desc" }, { createdAt: "desc" }],
        take: 1
      }
    }
  });

  if (!sppg) {
    throw new AppError("SPPG not found.", 404, "SPPG_NOT_FOUND");
  }

  const [studentAggregate, distributionStats, activeSchoolCount, activeIssueCount, totalDistributionCount] =
    await Promise.all([
    prisma.school.aggregate({
      where: {
        sppgId: sppg.id,
        deletedAt: null
      },
      _sum: {
        totalStudents: true
      }
    }),
    prisma.distribution.groupBy({
      by: ["status"],
      where: {
        sppgId: sppg.id
      },
      _count: {
        _all: true
      }
    }),
    prisma.school.count({
      where: {
        sppgId: sppg.id,
        deletedAt: null
      }
    }),
    prisma.issue.count({
      where: {
        sppgId: sppg.id,
        deletedAt: null
      }
    }),
    prisma.distribution.count({
      where: {
        sppgId: sppg.id
      }
    })
  ]);

  const stats = distributionStats.reduce(
    (accumulator, item) => {
      accumulator[item.status] = item._count._all;
      return accumulator;
    },
    {
      in_progress: 0,
      delivered: 0,
      failed: 0
    }
  );

  return {
    data: {
      ...sppg,
      latestMenu: sppg.menus[0] || null,
      stats: {
        totalSchools: activeSchoolCount,
        totalStudents: studentAggregate._sum.totalStudents || 0,
        totalDistributions: totalDistributionCount,
        totalIssues: activeIssueCount,
        distributionsByStatus: stats
      }
    }
  };
};

const createSppg = async ({ payload, actorUserId, ipAddress }) => {
  const data = {
    name: payload.name.trim(),
    province: payload.province.trim(),
    city: payload.city.trim(),
    address: payload.address ?? null,
    lat: payload.lat ?? null,
    lng: payload.lng ?? null,
    capacity: payload.capacity,
    workers: payload.workers ?? null,
    picName: payload.picName ?? null,
    picPhone: payload.picPhone ?? null,
    status: payload.status || "active"
  };

  const sppg = await prisma.$transaction(async (tx) => {
    const created = await tx.sppg.create({
      data
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "INSERT",
      tableName: "sppg",
      recordId: created.id,
      newData: created,
      ipAddress
    });

    return created;
  });

  return {
    data: sppg
  };
};

const updateSppg = async ({ id, payload, actorUserId, ipAddress }) => {
  const existing = await getActiveSppgById(id);

  const updatedData = {
    ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
    ...(payload.province !== undefined ? { province: payload.province.trim() } : {}),
    ...(payload.city !== undefined ? { city: payload.city.trim() } : {}),
    ...(payload.address !== undefined ? { address: payload.address } : {}),
    ...(payload.lat !== undefined ? { lat: payload.lat } : {}),
    ...(payload.lng !== undefined ? { lng: payload.lng } : {}),
    ...(payload.capacity !== undefined ? { capacity: payload.capacity } : {}),
    ...(payload.workers !== undefined ? { workers: payload.workers } : {}),
    ...(payload.picName !== undefined ? { picName: payload.picName } : {}),
    ...(payload.picPhone !== undefined ? { picPhone: payload.picPhone } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {})
  };

  const sppg = await prisma.$transaction(async (tx) => {
    const updated = await tx.sppg.update({
      where: {
        id: existing.id
      },
      data: updatedData
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "UPDATE",
      tableName: "sppg",
      recordId: updated.id,
      oldData: existing,
      newData: updated,
      ipAddress
    });

    return updated;
  });

  return {
    data: sppg
  };
};

const deleteSppg = async ({ id, actorUserId, ipAddress }) => {
  const existing = await getActiveSppgById(id);

  const deletedAt = new Date();

  const sppg = await prisma.$transaction(async (tx) => {
    const updated = await tx.sppg.update({
      where: {
        id: existing.id
      },
      data: {
        deletedAt
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "DELETE",
      tableName: "sppg",
      recordId: updated.id,
      oldData: existing,
      newData: updated,
      ipAddress
    });

    return updated;
  });

  return {
    data: sppg
  };
};

module.exports = {
  createSppg,
  deleteSppg,
  getSppgDetail,
  listSppg,
  updateSppg
};
