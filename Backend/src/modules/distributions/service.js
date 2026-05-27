const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAnomalyIfNeeded } = require("../../utils/anomaly");
const { createAuditLog } = require("../../utils/auditLog");
const { endOfDayUtc, startOfDayUtc } = require("../../utils/date");
const { checkDistributionPriceAnomaly } = require("../../utils/distributionPriceAnomaly");
const {
  assertSchoolOwnership,
  assertSppgOwnership,
  requireSchoolScope,
  requireSppgScope
} = require("../../utils/ownership");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");
const {
  buildTokenSearchOr,
  getRankedSearchCandidateLimit,
  hasSearchQuery,
  mergeWhereWithAnd,
  paginateRankedSearch,
  textContains
} = require("../../utils/search");
const {
  createNotificationsForUsers,
  findUserIdsBySchoolId,
  findUserIdsBySppgId
} = require("../../utils/notification");
const productionBatchService = require("../productionBatches/service");

const prisma = getPrismaClient();

const isUnlockWindowExpired = (distribution) =>
  Boolean(!distribution.isLocked && distribution.unlockedUntil && distribution.unlockedUntil <= new Date());

const parseBooleanFilter = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return value;
};

const maybeWhere = (condition) => (condition && Object.keys(condition).length ? [condition] : []);

const buildDistributionWhere = ({ query = {}, user }) => {
  const isLockedFilter = parseBooleanFilter(query.isLocked);
  const where = {
    school: {
      deletedAt: null
    },
    sppg: {
      deletedAt: null
    },
    ...(query.date ? { distributionDate: new Date(query.date) } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          distributionDate: {
            ...(query.dateFrom ? { gte: startOfDayUtc(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: endOfDayUtc(query.dateTo) } : {})
          }
        }
      : {}),
    ...(query.status ? { status: query.status } : {})
  };

  if (isLockedFilter !== undefined) {
    where.isLocked = isLockedFilter;
  }

  if (query.province) {
    where.OR = [
      {
        sppg: {
          deletedAt: null,
          province: {
            contains: query.province,
            mode: "insensitive"
          }
        }
      },
      {
        school: {
          deletedAt: null,
          province: {
            contains: query.province,
            mode: "insensitive"
          }
        }
      }
    ];
  }

  if (query.search) {
    const search = query.search.trim();
    const searchWhere = buildTokenSearchOr(search, [
      (token) => ({
        sppg: {
          deletedAt: null,
          name: {
            contains: token,
            mode: "insensitive"
          }
        }
      }),
      (token) => ({
        school: {
          deletedAt: null,
          name: {
            contains: token,
            mode: "insensitive"
          }
        }
      }),
      (token) => ({
        school: {
          deletedAt: null,
          city: {
            contains: token,
            mode: "insensitive"
          }
        }
      }),
      (token) => ({
        school: {
          deletedAt: null,
          province: {
            contains: token,
            mode: "insensitive"
          }
        }
      })
    ]);
    const searchOr = [
      ...maybeWhere(searchWhere),
      ...(Number.isInteger(Number(search)) ? [{ id: Number(search) }] : [])
    ];

    if (where.OR) {
      where.AND = [
        {
          OR: where.OR
        },
        searchOr.length === 1 ? searchOr[0] : { OR: searchOr }
      ];
      delete where.OR;
    } else {
      Object.assign(where, searchOr.length === 1 ? searchOr[0] : { OR: searchOr });
    }
  }

  if (user.role === "sppg") {
    where.sppgId = requireSppgScope(user);
    return where;
  }

  if (user.role === "sekolah") {
    where.schoolId = requireSchoolScope(user);
    return where;
  }

  if (query.sppgId) {
    where.sppgId = Number(query.sppgId);
  }

  if (query.schoolId) {
    where.schoolId = Number(query.schoolId);
  }

  return where;
};

const buildDistributionBaseWhere = ({ query = {}, user }) =>
  buildDistributionWhere({
    query: {
      ...query,
      search: undefined
    },
    user
  });

const buildLooseDistributionSearchWhere = (search) => {
  const tokenWhere = buildTokenSearchOr(search, [
    (token) => ({ sppg: { deletedAt: null, name: textContains(token) } }),
    (token) => ({ school: { deletedAt: null, name: textContains(token) } }),
    (token) => ({ school: { deletedAt: null, city: textContains(token) } }),
    (token) => ({ school: { deletedAt: null, province: textContains(token) } })
  ]);
  const numericFilter = Number.isInteger(Number(search)) ? [{ id: Number(search) }] : [];

  if (!Object.keys(tokenWhere).length && !numericFilter.length) return {};

  if (!numericFilter.length) return tokenWhere;
  return { OR: [...numericFilter, tokenWhere] };
};

const DISTRIBUTION_SEARCH_RANK_FIELDS = [
  { value: (item) => item.sppg?.name, weight: 5 },
  { value: (item) => item.school?.name, weight: 7 },
  { value: (item) => item.school?.city, weight: 3 },
  { value: (item) => item.school?.province, weight: 2 },
  { field: "status", weight: 2 },
  { field: "id", weight: 0.25 }
];

const decorateDistributionStatus = (distribution) => distribution
  ? {
      ...distribution,
      deliveryStatus: distribution.status,
      confirmationStatus: distribution.validation?.status || "pending"
    }
  : distribution;

const getActiveSppg = async (id) => {
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

const ensureActiveSchoolAssignment = async ({ sppgId, schoolId }) => {
  const assignment = await prisma.sppgSchoolAssignment.findFirst({
    where: {
      sppgId: Number(sppgId),
      schoolId: Number(schoolId),
      status: "active"
    }
  });

  if (!assignment) {
    throw new AppError(
      "Sekolah belum terdaftar sebagai sekolah saluran SPPG ini.",
      403,
      "SCHOOL_NOT_ASSIGNED_TO_SPPG"
    );
  }

  return assignment;
};

const getDistributionById = async (id) => {
  const distribution = await prisma.distribution.findUnique({
    where: {
      id: Number(id)
    },
    include: {
      sppg: true,
      school: true,
      productionBatch: true,
      validation: true,
      proofs: {
        include: {
          file: true,
          uploader: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      }
    }
  });

  if (!distribution) {
    throw new AppError("Distribution not found.", 404, "DISTRIBUTION_NOT_FOUND");
  }

  if (distribution.sppg?.deletedAt) {
    throw new AppError("Distribution SPPG is no longer active.", 404, "SPPG_NOT_FOUND");
  }

  if (distribution.school?.deletedAt) {
    throw new AppError("Distribution school is no longer active.", 404, "SCHOOL_NOT_FOUND");
  }

  return distribution;
};

const ensureDistributionAccess = (user, distribution) => {
  if (user.role === "sppg") {
    assertSppgOwnership(user, distribution.sppgId);
  }

  if (user.role === "sekolah") {
    assertSchoolOwnership(user, distribution.schoolId);
  }
};

const detectDistributionAnomalies = async ({ tx, distribution, sppg, actorUserId = null, ipAddress = null }) => {
  if (distribution.portions > sppg.capacity) {
    await createAnomalyIfNeeded({
      prisma: tx,
      distributionId: distribution.id,
      anomalyType: "OVER_CAPACITY",
      description: `Distribution portions ${distribution.portions} exceed SPPG capacity ${sppg.capacity}.`,
      actorUserId,
      ipAddress
    });
  }

  await checkDistributionPriceAnomaly({
    prisma: tx,
    distribution,
    province: sppg.province,
    actorUserId,
    ipAddress
  });
};

const createDeliveredNotification = async ({ tx, distribution }) => {
  const schoolUserIds = await findUserIdsBySchoolId(tx, distribution.schoolId);

  await createNotificationsForUsers({
    prisma: tx,
    userIds: schoolUserIds,
    type: "distribution",
    title: "Distribusi Terkirim",
    message: `Distribusi untuk sekolah ${distribution.school.name} telah berstatus delivered.`,
    payload: {
      distributionId: distribution.id,
      schoolId: distribution.schoolId,
      sppgId: distribution.sppgId,
      status: distribution.status
    }
  });
};

const createDistributionCreatedNotification = async ({ tx, distribution }) => {
  const schoolUserIds = await findUserIdsBySchoolId(tx, distribution.schoolId);

  await createNotificationsForUsers({
    prisma: tx,
    userIds: schoolUserIds,
    type: "distribution",
    title: "Distribusi Baru",
    message: `Distribusi baru untuk sekolah ${distribution.school.name} telah dibuat.`,
    payload: {
      distributionId: distribution.id,
      schoolId: distribution.schoolId,
      sppgId: distribution.sppgId,
      status: distribution.status
    },
    eventName: "distribution:new",
    eventPayload: {
      distributionId: distribution.id,
      schoolId: distribution.schoolId,
      sppgId: distribution.sppgId,
      status: distribution.status
    }
  });
};

const createDistributionLockedNotification = async ({ tx, distribution }) => {
  const sppgUserIds = await findUserIdsBySppgId(tx, distribution.sppgId);

  await createNotificationsForUsers({
    prisma: tx,
    userIds: sppgUserIds,
    type: "system",
    title: "Distribusi Dikunci",
    message: `Distribusi #${distribution.id} untuk sekolah ${distribution.school.name} telah dikunci.`,
    payload: {
      distributionId: distribution.id,
      schoolId: distribution.schoolId,
      sppgId: distribution.sppgId,
      isLocked: true
    },
    eventName: "distribution:locked",
    eventPayload: {
      distributionId: distribution.id,
      schoolId: distribution.schoolId,
      sppgId: distribution.sppgId,
      isLocked: true
    }
  });
};

const createLockAuditIfNeeded = async ({ tx, userId, oldData, newData, ipAddress }) => {
  if (!oldData.isLocked && newData.isLocked) {
    await createAuditLog({
      prisma: tx,
      userId,
      action: "LOCK",
      tableName: "distributions",
      recordId: newData.id,
      oldData,
      newData,
      ipAddress
    });
  }
};

const relockExpiredDistributionWindow = async ({ distribution, ipAddress }) =>
  prisma.$transaction(async (tx) => {
    const relocked = await tx.distribution.update({
      where: {
        id: distribution.id
      },
      data: {
        isLocked: true,
        unlockedUntil: null
      },
      include: {
        sppg: true,
        school: true
      }
    });

    await createAuditLog({
      prisma: tx,
      action: "LOCK",
      tableName: "distributions",
      recordId: distribution.id,
      oldData: distribution,
      newData: relocked,
      ipAddress
    });

    await createDistributionLockedNotification({
      tx,
      distribution: {
        ...distribution,
        isLocked: true,
        unlockedUntil: null
      }
    });
  });

const listDistributions = async ({ query, user }) => {
  const pagination = parsePagination(query);
  const where = buildDistributionWhere({ query, user });
  const include = {
    sppg: true,
    school: true,
    productionBatch: true,
    validation: true
  };

  if (hasSearchQuery(query.search)) {
    const baseWhere = buildDistributionBaseWhere({ query, user });
    const candidateLimit = getRankedSearchCandidateLimit(pagination);
    let candidates = await prisma.distribution.findMany({
      where: mergeWhereWithAnd(baseWhere, buildLooseDistributionSearchWhere(query.search)),
      include,
      take: candidateLimit,
      orderBy: [{ distributionDate: "desc" }, { createdAt: "desc" }]
    });

    const ranked = paginateRankedSearch({
      items: candidates,
      query: query.search,
      fieldConfigs: DISTRIBUTION_SEARCH_RANK_FIELDS,
      pagination
    });

    return {
      data: ranked.items.map(decorateDistributionStatus),
      meta: {
        ...buildPaginationMeta({
          page: pagination.page,
          limit: pagination.limit,
          total: ranked.total
        }),
        searchMode: "partial_fuzzy_ranked"
      }
    };
  }

  const [items, total] = await Promise.all([
    prisma.distribution.findMany({
      where,
      include,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ distributionDate: "desc" }, { createdAt: "desc" }]
    }),
    prisma.distribution.count({ where })
  ]);

  return {
    data: items.map(decorateDistributionStatus),
    meta: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total
    })
  };
};

const getLockSummary = async () => {
  const now = new Date();
  const [totalCount, lockedCount, autoLockPendingCount] = await Promise.all([
    prisma.distribution.count(),
    prisma.distribution.count({
      where: {
        isLocked: true
      }
    }),
    prisma.distribution.count({
      where: {
        isLocked: false,
        unlockedUntil: {
          gt: now
        }
      }
    })
  ]);
  const editableCount = totalCount - lockedCount;

  return {
    data: {
      totalCount,
      total_count: totalCount,
      lockedCount,
      locked_count: lockedCount,
      editableCount,
      editable_count: editableCount,
      autoLockPendingCount,
      auto_lock_pending_count: autoLockPendingCount
    }
  };
};

const getDistributionDetail = async ({ id, user }) => {
  const distribution = await getDistributionById(id);
  ensureDistributionAccess(user, distribution);

  return {
    data: decorateDistributionStatus(distribution)
  };
};

const createDistribution = async ({ payload, user, ipAddress }) => {
  const targetSppgId = user.role === "sppg" ? requireSppgScope(user) : payload.sppgId;

  if (!targetSppgId) {
    throw new AppError("sppgId is required.", 400, "SPPG_ID_REQUIRED");
  }

  if (user.role === "sppg") {
    assertSppgOwnership(user, targetSppgId);
  }

  const [sppg, school] = await Promise.all([getActiveSppg(targetSppgId), getActiveSchool(payload.schoolId)]);

  await ensureActiveSchoolAssignment({ sppgId: sppg.id, schoolId: school.id });

  const nextStatus = payload.status || "in_progress";
  const shouldLock = nextStatus === "delivered";

  const distribution = await prisma.$transaction(async (tx) => {
    const productionBatch = await productionBatchService.findBatchForDistribution({
      sppgId: sppg.id,
      distributionDate: payload.distributionDate,
      productionBatchId: payload.productionBatchId,
      client: tx
    });

    if (payload.productionBatchId && !productionBatch) {
      throw new AppError("Production batch not found for this SPPG.", 404, "PRODUCTION_BATCH_NOT_FOUND");
    }

    const pricePerPortion = payload.pricePerPortion ?? (productionBatch ? Number(productionBatch.costPerPortion) : null);

    if (!pricePerPortion) {
      throw new AppError(
        "pricePerPortion is required when no production batch costing is available.",
        400,
        "PRICE_PER_PORTION_REQUIRED"
      );
    }

    const created = await tx.distribution.create({
      data: {
        sppgId: sppg.id,
        schoolId: school.id,
        productionBatchId: productionBatch?.id ?? null,
        portions: payload.portions,
        pricePerPortion,
        distributionDate: new Date(payload.distributionDate),
        status: nextStatus,
        failureReason: payload.failureReason ?? null,
        isLocked: shouldLock,
        unlockedUntil: null
      },
      include: {
        sppg: true,
        school: true,
        productionBatch: true,
        validation: true,
        proofs: true
      }
    });

    await tx.validation.create({
      data: {
        distributionId: created.id,
        schoolId: school.id,
        receivedPortions: 0,
        status: "pending"
      }
    });

    await detectDistributionAnomalies({
      tx,
      distribution: created,
      sppg,
      actorUserId: user.userId,
      ipAddress
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "INSERT",
      tableName: "distributions",
      recordId: created.id,
      newData: created,
      ipAddress
    });

    await createDistributionCreatedNotification({
      tx,
      distribution: {
        ...created,
        school
      }
    });

    if (shouldLock) {
      await createAuditLog({
        prisma: tx,
        userId: user.userId,
        action: "LOCK",
        tableName: "distributions",
        recordId: created.id,
        newData: created,
        ipAddress
      });

      await createDeliveredNotification({
        tx,
        distribution: {
          ...created,
          school
        }
      });
    }

    return tx.distribution.findUnique({
      where: {
        id: created.id
      },
      include: {
        sppg: true,
        school: true,
        productionBatch: true,
        validation: true,
        proofs: {
          include: {
            file: true,
            uploader: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        }
      }
    });
  });

  return {
    data: decorateDistributionStatus(distribution)
  };
};

const updateDistribution = async ({ id, payload, user, ipAddress }) => {
  const existing = await getDistributionById(id);
  ensureDistributionAccess(user, existing);

  if (existing.isLocked && user.role !== "admin") {
    throw new AppError("Locked distributions can only be updated by admin.", 403, "DISTRIBUTION_LOCKED");
  }

  if (user.role !== "admin" && isUnlockWindowExpired(existing)) {
    await relockExpiredDistributionWindow({
      distribution: existing,
      ipAddress
    });

    throw new AppError(
      "Unlock window has expired. Distribution is locked again.",
      403,
      "DISTRIBUTION_UNLOCK_WINDOW_EXPIRED"
    );
  }

  const targetSppgId = payload.sppgId !== undefined ? payload.sppgId : existing.sppgId;
  const targetSchoolId = payload.schoolId !== undefined ? payload.schoolId : existing.schoolId;

  if (user.role === "sppg") {
    assertSppgOwnership(user, targetSppgId);
  }

  const [sppg, school] = await Promise.all([getActiveSppg(targetSppgId), getActiveSchool(targetSchoolId)]);

  await ensureActiveSchoolAssignment({ sppgId: sppg.id, schoolId: school.id });

  const nextStatus = payload.status ?? existing.status;
  const becameDelivered = existing.status !== "delivered" && nextStatus === "delivered";
  const nextIsLocked = becameDelivered ? true : existing.isLocked;
  const nextUnlockedUntil = becameDelivered ? null : existing.unlockedUntil;

  const distribution = await prisma.$transaction(async (tx) => {
    const productionBatch = await productionBatchService.findBatchForDistribution({
      sppgId: targetSppgId,
      distributionDate: payload.distributionDate ?? existing.distributionDate,
      productionBatchId: payload.productionBatchId,
      client: tx
    });

    if (payload.productionBatchId && !productionBatch) {
      throw new AppError("Production batch not found for this SPPG.", 404, "PRODUCTION_BATCH_NOT_FOUND");
    }

    const shouldUseBatchPrice = payload.pricePerPortion === undefined && payload.productionBatchId !== undefined;
    const nextPricePerPortion = shouldUseBatchPrice && productionBatch
      ? Number(productionBatch.costPerPortion)
      : payload.pricePerPortion;

    const updated = await tx.distribution.update({
      where: {
        id: existing.id
      },
      data: {
        ...(payload.sppgId !== undefined ? { sppgId: targetSppgId } : {}),
        ...(payload.schoolId !== undefined ? { schoolId: targetSchoolId } : {}),
        ...(payload.productionBatchId !== undefined ? { productionBatchId: productionBatch?.id ?? null } : {}),
        ...(payload.portions !== undefined ? { portions: payload.portions } : {}),
        ...(nextPricePerPortion !== undefined ? { pricePerPortion: nextPricePerPortion } : {}),
        ...(payload.distributionDate !== undefined ? { distributionDate: new Date(payload.distributionDate) } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.failureReason !== undefined ? { failureReason: payload.failureReason } : {}),
        isLocked: nextIsLocked,
        unlockedUntil: nextUnlockedUntil
      }
    });

    await detectDistributionAnomalies({
      tx,
      distribution: updated,
      sppg,
      actorUserId: user.userId,
      ipAddress
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "UPDATE",
      tableName: "distributions",
      recordId: updated.id,
      oldData: existing,
      newData: updated,
      ipAddress
    });

    await createLockAuditIfNeeded({
      tx,
      userId: user.userId,
      oldData: existing,
      newData: updated,
      ipAddress
    });

    if (becameDelivered) {
      await createDeliveredNotification({
        tx,
        distribution: {
          ...updated,
          school
        }
      });
    }

    if (!existing.isLocked && updated.isLocked) {
      await createDistributionLockedNotification({
        tx,
        distribution: {
          ...updated,
          school
        }
      });
    }

    return tx.distribution.findUnique({
      where: {
        id: updated.id
      },
      include: {
        sppg: true,
        school: true,
        productionBatch: true,
        validation: true,
        proofs: {
          include: {
            file: true,
            uploader: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        }
      }
    });
  });

  return {
    data: decorateDistributionStatus(distribution)
  };
};

module.exports = {
  createDistribution,
  getDistributionDetail,
  getLockSummary,
  listDistributions,
  updateDistribution
};
