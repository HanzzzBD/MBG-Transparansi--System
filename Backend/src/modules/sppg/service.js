const { Prisma } = require("@prisma/client");

const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");

const prisma = getPrismaClient();

const toNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const toDateOnly = (value = new Date()) => {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const normalizeValue = (value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === "object") {
    if (typeof value.toJSON === "function" && value.constructor?.name !== "Object") {
      return normalizeValue(value.toJSON());
    }

    return Object.entries(value).reduce((accumulator, [key, nestedValue]) => {
      accumulator[key] = normalizeValue(nestedValue);
      return accumulator;
    }, {});
  }

  return value;
};

const normalizeRows = (rows) => rows.map((row) => normalizeValue(row));

const buildSppgWhere = (query = {}) => ({
  deletedAt: null,
  ...(query.province ? { province: { contains: query.province, mode: "insensitive" } } : {}),
  ...(query.city ? { city: { contains: query.city, mode: "insensitive" } } : {}),
  ...(query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { province: { contains: query.search, mode: "insensitive" } },
          { city: { contains: query.search, mode: "insensitive" } },
          { address: { contains: query.search, mode: "insensitive" } }
        ]
      }
    : {}),
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

const buildMapMarkerSqlWhere = (query = {}) => {
  const conditions = [Prisma.sql`s.deleted_at IS NULL`, Prisma.sql`s.lat IS NOT NULL`, Prisma.sql`s.lng IS NOT NULL`];

  if (query.province) {
    conditions.push(Prisma.sql`s.province ILIKE ${`%${query.province}%`}`);
  }

  if (query.city) {
    conditions.push(Prisma.sql`s.city ILIKE ${`%${query.city}%`}`);
  }

  if (query.search) {
    const search = `%${query.search}%`;
    conditions.push(
      Prisma.sql`(s.name ILIKE ${search} OR s.province ILIKE ${search} OR s.city ILIKE ${search} OR s.address ILIKE ${search})`
    );
  }

  if (query.status) {
    conditions.push(Prisma.sql`s.status = ${query.status}::"SppgStatus"`);
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
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

const listMapMarkers = async ({ query = {} }) => {
  const today = toDateOnly();
  const whereSql = buildMapMarkerSqlWhere(query);

  const rows = await prisma.$queryRaw`
    SELECT
      s.id,
      s.name,
      s.status::text AS status,
      s.lat,
      s.lng,
      s.province,
      s.city,
      COALESCE(
        ROUND(
          100.0 * COUNT(v.id) FILTER (WHERE v.status = 'verified')
          / NULLIF(COUNT(v.id) FILTER (WHERE v.status IN ('verified', 'conflict')), 0),
          1
        ),
        0
      ) AS success_rate,
      COALESCE(
        SUM(d.portions) FILTER (WHERE d.distribution_date = ${today}),
        0
      )::int AS porsi_hari_ini
    FROM sppg s
    LEFT JOIN distributions d ON d.sppg_id = s.id
    LEFT JOIN schools sc ON sc.id = d.school_id AND sc.deleted_at IS NULL
    LEFT JOIN validations v ON v.distribution_id = d.id
    ${whereSql}
    GROUP BY s.id
    ORDER BY s.province ASC, s.city ASC, s.name ASC
  `;

  return {
    data: normalizeRows(rows).map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      lat: toNumber(row.lat),
      lng: toNumber(row.lng),
      province: row.province,
      city: row.city,
      successRate: toNumber(row.success_rate),
      porsiHariIni: toNumber(row.porsi_hari_ini)
    }))
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

const serializeMenu = (menu) =>
  menu
    ? {
        id: menu.id,
        menuDate: menu.menuDate,
        menuName: menu.menuName,
        calories: menu.calories,
        proteinG: menu.proteinG,
        carbsG: menu.carbsG,
        fatG: menu.fatG
      }
    : null;

const serializeProductionBatch = (batch) =>
  batch
    ? {
        id: batch.id,
        productionDate: batch.productionDate,
        totalPortions: batch.totalPortions,
        totalCost: toNumber(batch.totalCost),
        costPerPortion: toNumber(batch.costPerPortion),
        menu: serializeMenu(batch.menu)
      }
    : null;

const serializeDistribution = (distribution) => ({
  id: distribution.id,
  portions: distribution.portions,
  pricePerPortion: toNumber(distribution.pricePerPortion),
  totalCost: toNumber(distribution.totalCost),
  distributionDate: distribution.distributionDate,
  status: distribution.status,
  failureReason: distribution.failureReason,
  school: distribution.school
    ? {
        id: distribution.school.id,
        name: distribution.school.name,
        province: distribution.school.province,
        city: distribution.school.city
      }
    : null,
  validation: distribution.validation
    ? {
        id: distribution.validation.id,
        status: distribution.validation.status,
        receivedPortions: distribution.validation.receivedPortions,
        qualityOk: distribution.validation.qualityOk,
        validatedAt: distribution.validation.validatedAt
      }
    : null
});

const serializeAnomaly = (anomaly) => ({
  id: anomaly.id,
  anomalyType: anomaly.anomalyType,
  description: anomaly.description,
  createdAt: anomaly.createdAt,
  isResolved: anomaly.isResolved,
  distribution: anomaly.distribution
    ? {
        id: anomaly.distribution.id,
        status: anomaly.distribution.status,
        distributionDate: anomaly.distribution.distributionDate,
        school: anomaly.distribution.school
          ? {
              id: anomaly.distribution.school.id,
              name: anomaly.distribution.school.name
            }
          : null
      }
    : null,
  productionBatch: anomaly.productionBatch
    ? {
        id: anomaly.productionBatch.id,
        productionDate: anomaly.productionBatch.productionDate
      }
    : null
});

const getSppgOperationalDetail = async ({ id }) => {
  const sppgId = Number(id);
  const today = toDateOnly();

  const sppg = await prisma.sppg.findFirst({
    where: {
      id: sppgId,
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      province: true,
      city: true,
      address: true,
      lat: true,
      lng: true,
      capacity: true,
      workers: true,
      picName: true,
      picPhone: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!sppg) {
    throw new AppError("SPPG not found.", 404, "SPPG_NOT_FOUND");
  }

  const todayDistributionWhere = {
    sppgId,
    distributionDate: today,
    school: {
      deletedAt: null
    }
  };

  const [
    menuToday,
    productionBatchToday,
    latestDistributions,
    activeAnomalies,
    schoolAgg,
    schoolCount,
    totalDistributionCount,
    todayPortionAgg,
    deliveredToday,
    failedToday,
    pendingValidationCount,
    verifiedCount,
    validatedCount,
    activeAnomalyCount
  ] = await Promise.all([
    prisma.menu.findFirst({
      where: {
        sppgId,
        menuDate: today,
        deletedAt: null
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.productionBatch.findFirst({
      where: {
        sppgId,
        productionDate: today
      },
      include: {
        menu: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.distribution.findMany({
      where: {
        sppgId,
        school: {
          deletedAt: null
        }
      },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            province: true,
            city: true
          }
        },
        validation: {
          select: {
            id: true,
            status: true,
            receivedPortions: true,
            qualityOk: true,
            validatedAt: true
          }
        }
      },
      orderBy: [{ distributionDate: "desc" }, { createdAt: "desc" }],
      take: 7
    }),
    prisma.anomalyLog.findMany({
      where: {
        isResolved: false,
        OR: [
          {
            distribution: {
              sppgId,
              school: {
                deletedAt: null
              }
            }
          },
          {
            productionBatch: {
              sppgId
            }
          }
        ]
      },
      include: {
        distribution: {
          include: {
            school: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        productionBatch: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    }),
    prisma.school.aggregate({
      where: {
        sppgId,
        deletedAt: null
      },
      _sum: {
        totalStudents: true
      }
    }),
    prisma.school.count({
      where: {
        sppgId,
        deletedAt: null
      }
    }),
    prisma.distribution.count({
      where: {
        sppgId,
        school: {
          deletedAt: null
        }
      }
    }),
    prisma.distribution.aggregate({
      where: todayDistributionWhere,
      _sum: {
        portions: true
      }
    }),
    prisma.distribution.count({
      where: {
        ...todayDistributionWhere,
        status: "delivered"
      }
    }),
    prisma.distribution.count({
      where: {
        ...todayDistributionWhere,
        status: "failed"
      }
    }),
    prisma.validation.count({
      where: {
        status: "pending",
        distribution: {
          sppgId,
          school: {
            deletedAt: null
          }
        }
      }
    }),
    prisma.validation.count({
      where: {
        status: "verified",
        distribution: {
          sppgId,
          school: {
            deletedAt: null
          }
        }
      }
    }),
    prisma.validation.count({
      where: {
        status: {
          in: ["verified", "conflict"]
        },
        distribution: {
          sppgId,
          school: {
            deletedAt: null
          }
        }
      }
    }),
    prisma.anomalyLog.count({
      where: {
        isResolved: false,
        OR: [
          {
            distribution: {
              sppgId,
              school: {
                deletedAt: null
              }
            }
          },
          {
            productionBatch: {
              sppgId
            }
          }
        ]
      }
    })
  ]);

  const successRate =
    validatedCount === 0 ? 0 : Number(((verifiedCount / validatedCount) * 100).toFixed(1));

  return {
    data: {
      info: {
        id: sppg.id,
        name: sppg.name,
        address: sppg.address,
        lat: sppg.lat,
        lng: sppg.lng
      },
      id: sppg.id,
      name: sppg.name,
      capacity: sppg.capacity,
      pic: {
        name: sppg.picName,
        phone: sppg.picPhone
      },
      province: sppg.province,
      city: sppg.city,
      status: sppg.status,
      isActive: sppg.status === "active",
      workers: sppg.workers,
      menuHariIni: serializeMenu(menuToday || productionBatchToday?.menu || null),
      productionBatchHariIni: serializeProductionBatch(productionBatchToday),
      distribusiTerakhir: latestDistributions.map(serializeDistribution),
      anomalyAktif: activeAnomalies.map(serializeAnomaly),
      kpiSummary: {
        totalSchools: schoolCount,
        totalStudents: schoolAgg._sum.totalStudents || 0,
        totalDistributions: totalDistributionCount,
        porsiHariIni: todayPortionAgg._sum.portions || 0,
        successRate,
        deliveredToday,
        failedToday,
        pendingValidationCount,
        activeAnomalyCount
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
  getSppgOperationalDetail,
  getSppgDetail,
  listMapMarkers,
  listSppg,
  updateSppg
};
