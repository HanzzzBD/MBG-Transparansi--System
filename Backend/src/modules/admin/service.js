const bcrypt = require("bcrypt");

const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAnomalyIfNeeded } = require("../../utils/anomaly");
const { createAuditLog } = require("../../utils/auditLog");
const { checkDistributionPriceAnomaly } = require("../../utils/distributionPriceAnomaly");
const { endOfDayUtc, startOfDayUtc } = require("../../utils/date");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");
const {
  buildRankedSearchCandidateWhere,
  buildTokenSearchWhere,
  getRankedSearchCandidateLimit,
  hasSearchQuery,
  paginateRankedSearch
} = require("../../utils/search");
const {
  createNotificationsForUsers,
  findUserIdsBySchoolId,
  findUserIdsBySppgId
} = require("../../utils/notification");
const authService = require("../auth/service");
const productionBatchService = require("../productionBatches/service");
const { BCRYPT_ROUNDS } = require("../../utils/auth");

const prisma = getPrismaClient();

const DISTRIBUTION_UNLOCK_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_EXPORT_MAX_ROWS = 50000;
const USER_ROLES = [
  {
    value: "admin",
    label: "Admin",
    description: "Akses penuh ke konfigurasi sistem, data master, user, audit, dan operasional."
  },
  {
    value: "pemerintah",
    label: "Pemerintah",
    description: "Akses monitoring pemerintah, analytics, audit operasional, dan laporan."
  },
  {
    value: "sppg",
    label: "SPPG",
    description: "Akses operasional produksi, menu, distribusi, dan isu untuk SPPG terkait."
  },
  {
    value: "sekolah",
    label: "Sekolah",
    description: "Akses konfirmasi penerimaan, validasi, dan laporan sekolah terkait."
  },
  {
    value: "umum",
    label: "Umum",
    description: "Akun viewer terbatas tanpa scope operasional khusus."
  }
];

const assertActionReason = (reason, code = "ACTION_REASON_REQUIRED") => {
  if (!reason || !String(reason).trim()) {
    throw new AppError("Reason is required.", 400, code);
  }
};

const parseBooleanFilter = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return value;
};

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  sppgId: true,
  schoolId: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  sppg: {
    select: {
      id: true,
      name: true,
      province: true,
      city: true
    }
  },
  school: {
    select: {
      id: true,
      name: true,
      province: true,
      city: true,
      sppgId: true
    }
  }
};

const distributionDetailInclude = {
  sppg: true,
  school: true,
  validation: true,
  productionBatch: true,
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
};

const buildCreatedAtRange = (query = {}) => {
  if (!query.start_date && !query.end_date) {
    return undefined;
  }

  return {
    ...(query.start_date ? { gte: startOfDayUtc(query.start_date) } : {}),
    ...(query.end_date ? { lte: endOfDayUtc(query.end_date) } : {})
  };
};

const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: {
      id: Number(id)
    },
    select: userSelect
  });

  if (!user) {
    throw new AppError("User not found.", 404, "USER_NOT_FOUND");
  }

  return user;
};

const getManageableUserById = async (id) => {
  const user = await prisma.user.findFirst({
    where: {
      id: Number(id),
      deletedAt: null
    },
    select: userSelect
  });

  if (!user) {
    throw new AppError("User not found.", 404, "USER_NOT_FOUND");
  }

  return user;
};

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

const getDistributionById = async (id) => {
  const distribution = await prisma.distribution.findUnique({
    where: {
      id: Number(id)
    },
    include: distributionDetailInclude
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

const validateScopeAssignment = async ({ role, sppgId, schoolId }) => {
  if (role === "sppg") {
    if (!sppgId) {
      throw new AppError("sppgId is required for sppg accounts.", 400, "SPPG_ID_REQUIRED");
    }

    await getActiveSppg(sppgId);
    return;
  }

  if (role === "sekolah") {
    if (!schoolId) {
      throw new AppError("schoolId is required for sekolah accounts.", 400, "SCHOOL_ID_REQUIRED");
    }

    await getActiveSchool(schoolId);
  }
};

const revokeUserSessions = async (tx, userId) =>
  tx.userSession.updateMany({
    where: {
      userId: Number(userId),
      isRevoked: false
    },
    data: {
      isRevoked: true
    }
  });

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

const listUsers = async ({ query }) => {
  const pagination = parsePagination(query);
  const isActiveFilter = parseBooleanFilter(query.isActive);
  const baseWhere = {
    deletedAt: null,
    ...(query.role ? { role: query.role } : {}),
    ...(isActiveFilter !== undefined ? { isActive: isActiveFilter } : {})
  };
  const where = {
    ...baseWhere,
    ...buildTokenSearchWhere(query.search, ["name", "email"])
  };

  if (hasSearchQuery(query.search)) {
    const candidateLimit = getRankedSearchCandidateLimit(pagination);
    let candidates = await prisma.user.findMany({
      where: buildRankedSearchCandidateWhere(baseWhere, query.search, ["name", "email"]),
      select: userSelect,
      take: candidateLimit,
      orderBy: [{ deletedAt: "asc" }, { createdAt: "desc" }]
    });

    const ranked = paginateRankedSearch({
      items: candidates,
      query: query.search,
      fieldConfigs: [
        { field: "name", weight: 7 },
        { field: "email", weight: 4 },
        { field: "role", weight: 1 }
      ],
      pagination
    });

    return {
      data: ranked.items,
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
    prisma.user.findMany({
      where,
      select: userSelect,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ deletedAt: "asc" }, { createdAt: "desc" }]
    }),
    prisma.user.count({ where })
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

const listRoles = async () => ({
  data: USER_ROLES
});

const createUser = async ({ payload, actorUserId, ipAddress }) => {
  const result = await authService.register({
    actorUserId,
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: payload.role,
    sppgId: payload.sppgId,
    schoolId: payload.schoolId,
    ipAddress
  });

  if (payload.isActive === false) {
    await updateUser({
      id: result.user.id,
      payload: {
        isActive: false
      },
      actorUserId,
      ipAddress
    });
  }

  return {
    data: await getUserById(result.user.id)
  };
};

const updateUser = async ({ id, payload, actorUserId, ipAddress }) => {
  const existing = await getManageableUserById(id);
  const nextRole = payload.role ?? existing.role;
  const normalizedEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : undefined;

  if (normalizedEmail && normalizedEmail !== existing.email) {
    const emailOwner = await prisma.user.findUnique({
      where: {
        email: normalizedEmail
      },
      select: {
        id: true
      }
    });

    if (emailOwner && emailOwner.id !== existing.id) {
      throw new AppError("A user with this email already exists.", 409, "EMAIL_ALREADY_EXISTS");
    }
  }

  if (payload.sppgId !== undefined && nextRole !== "sppg") {
    throw new AppError("sppgId can only be set for sppg accounts.", 400, "SPPG_SCOPE_INVALID");
  }

  if (payload.schoolId !== undefined && nextRole !== "sekolah") {
    throw new AppError("schoolId can only be set for sekolah accounts.", 400, "SCHOOL_SCOPE_INVALID");
  }

  let nextSppgId = payload.sppgId !== undefined ? payload.sppgId : existing.sppgId;
  let nextSchoolId = payload.schoolId !== undefined ? payload.schoolId : existing.schoolId;

  if (nextRole === "sppg") {
    nextSchoolId = null;
  }

  if (nextRole === "sekolah") {
    nextSppgId = null;
  }

  if (!["sppg", "sekolah"].includes(nextRole)) {
    nextSppgId = null;
    nextSchoolId = null;
  }

  await validateScopeAssignment({
    role: nextRole,
    sppgId: nextSppgId,
    schoolId: nextSchoolId
  });

  const shouldRevokeSessions = payload.isActive === false;
  const passwordHash = payload.password ? await bcrypt.hash(payload.password, BCRYPT_ROUNDS) : null;

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: {
        id: existing.id
      },
      data: {
        ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
        ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
        ...(passwordHash ? { password: passwordHash } : {}),
        ...(payload.role !== undefined ? { role: nextRole } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        sppgId: nextSppgId,
        schoolId: nextSchoolId
      },
      select: userSelect
    });

    if (shouldRevokeSessions) {
      await revokeUserSessions(tx, updated.id);
    }

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "UPDATE",
      tableName: "users",
      recordId: updated.id,
      oldData: existing,
      newData: updated,
      ipAddress
    });

    return updated;
  });

  return {
    data: user
  };
};

const deleteUser = async ({ id, actorUserId, ipAddress }) => {
  const existing = await getManageableUserById(id);

  const user = await prisma.$transaction(async (tx) => {
    const deleted = await tx.user.update({
      where: {
        id: existing.id
      },
      data: {
        isActive: false,
        deletedAt: new Date()
      },
      select: userSelect
    });

    await revokeUserSessions(tx, deleted.id);

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "DELETE",
      tableName: "users",
      recordId: deleted.id,
      oldData: existing,
      newData: deleted,
      ipAddress
    });

    return deleted;
  });

  return {
    data: user
  };
};

const restoreUser = async ({ id, actorUserId, ipAddress }) => {
  const existing = await getUserById(id);

  if (!existing.deletedAt) {
    return {
      data: existing
    };
  }

  await validateScopeAssignment({
    role: existing.role,
    sppgId: existing.sppgId,
    schoolId: existing.schoolId
  });

  const user = await prisma.$transaction(async (tx) => {
    const restored = await tx.user.update({
      where: {
        id: existing.id
      },
      data: {
        deletedAt: null,
        isActive: true
      },
      select: userSelect
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "UPDATE",
      tableName: "users",
      recordId: restored.id,
      oldData: existing,
      newData: {
        ...restored,
        auditAction: "RESTORE"
      },
      ipAddress
    });

    return restored;
  });

  return {
    data: user
  };
};

const listAuditLogs = async ({ query }) => {
  const pagination = parsePagination(query);
  const where = {
    ...(query.table_name ? { tableName: query.table_name } : {}),
    ...(query.user_id ? { userId: Number(query.user_id) } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(buildCreatedAtRange(query) ? { createdAt: buildCreatedAtRange(query) } : {})
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
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
    prisma.auditLog.count({ where })
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

const getAuditLogsSummary = async () => {
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayRange = {
    gte: startOfDayUtc(todayKey),
    lte: endOfDayUtc(todayKey)
  };

  const [totalLogs, totalToday, highSeverity, activeUserRows, actionRows] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({
      where: {
        createdAt: todayRange
      }
    }),
    prisma.auditLog.count({
      where: {
        action: {
          in: ["DELETE", "LOCK", "UNLOCK"]
        }
      }
    }),
    prisma.auditLog.groupBy({
      by: ["userId"],
      where: {
        userId: {
          not: null
        },
        createdAt: todayRange
      }
    }),
    prisma.auditLog.groupBy({
      by: ["action"],
      _count: {
        _all: true
      }
    })
  ]);
  const byAction = actionRows.reduce((result, row) => {
    result[row.action] = row._count._all;
    return result;
  }, {});

  return {
    data: {
      totalLogs,
      total_logs: totalLogs,
      totalToday,
      total_today: totalToday,
      highSeverity,
      high_severity: highSeverity,
      activeUsers: activeUserRows.length,
      active_users: activeUserRows.length,
      byAction,
      by_action: byAction
    }
  };
};

const listAnomalyLogs = async ({ query }) => {
  const pagination = parsePagination(query);
  const where = {
    ...(query.is_resolved !== undefined ? { isResolved: query.is_resolved } : {}),
    ...(query.anomaly_type ? { anomalyType: query.anomaly_type } : {})
  };

  const [items, total] = await Promise.all([
    prisma.anomalyLog.findMany({
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
        productionBatchItem: true,
        resolver: {
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
    prisma.anomalyLog.count({ where })
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

const resolveAnomalyLog = async ({ id, actorUserId, ipAddress }) => {
  const anomaly = await prisma.anomalyLog.findUnique({
    where: {
      id: Number(id)
    },
    include: {
      distribution: {
        include: {
          sppg: true,
          school: true
        }
      },
      resolver: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    }
  });

  if (!anomaly) {
    throw new AppError("Anomaly log not found.", 404, "ANOMALY_LOG_NOT_FOUND");
  }

  if (anomaly.isResolved) {
    throw new AppError("Anomaly log is already resolved.", 400, "ANOMALY_ALREADY_RESOLVED");
  }

  const resolved = await prisma.$transaction(async (tx) => {
    const updated = await tx.anomalyLog.update({
      where: {
        id: anomaly.id
      },
      data: {
        isResolved: true,
        resolvedBy: actorUserId,
        resolvedAt: new Date()
      },
      include: {
        distribution: {
          include: {
            sppg: true,
            school: true
          }
        },
        resolver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "UPDATE",
      tableName: "anomaly_logs",
      recordId: updated.id,
      oldData: anomaly,
      newData: updated,
      ipAddress
    });

    return updated;
  });

  return {
    data: resolved
  };
};

const lockDistribution = async ({ id, actorUserId, ipAddress, reason = null }) => {
  assertActionReason(reason, "LOCK_REASON_REQUIRED");
  const existing = await getDistributionById(id);

  if (existing.isLocked && !existing.unlockedUntil) {
    return {
      data: existing
    };
  }

  const distribution = await prisma.$transaction(async (tx) => {
    const updated = await tx.distribution.update({
      where: {
        id: existing.id
      },
      data: {
        isLocked: true,
        unlockedUntil: null
      },
      include: distributionDetailInclude
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "LOCK",
      tableName: "distributions",
      recordId: updated.id,
      oldData: existing,
      newData: {
        ...updated,
        reason
      },
      ipAddress
    });

    await createDistributionLockedNotification({
      tx,
      distribution: updated
    });

    return updated;
  });

  return {
    data: distribution
  };
};

const unlockDistribution = async ({
  id,
  actorUserId,
  ipAddress,
  reason = null,
  autoRelockAfterOneHour = true
}) => {
  assertActionReason(reason, "UNLOCK_REASON_REQUIRED");
  const existing = await getDistributionById(id);
  const unlockedUntil = autoRelockAfterOneHour
    ? new Date(Date.now() + DISTRIBUTION_UNLOCK_WINDOW_MS)
    : null;

  const distribution = await prisma.$transaction(async (tx) => {
    const updated = await tx.distribution.update({
      where: {
        id: existing.id
      },
      data: {
        isLocked: false,
        unlockedUntil
      },
      include: distributionDetailInclude
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "UNLOCK",
      tableName: "distributions",
      recordId: updated.id,
      oldData: existing,
      newData: {
        ...updated,
        reason,
        autoRelockAfterOneHour
      },
      ipAddress
    });

    return updated;
  });

  return {
    data: distribution
  };
};

const overrideDistribution = async ({ id, payload, actorUserId, ipAddress }) => {
  assertActionReason(payload.overrideReason, "OVERRIDE_REASON_REQUIRED");
  const existing = await getDistributionById(id);
  const targetSppgId = payload.sppgId !== undefined ? payload.sppgId : existing.sppgId;
  const targetSchoolId = payload.schoolId !== undefined ? payload.schoolId : existing.schoolId;

  const [sppg, school] = await Promise.all([getActiveSppg(targetSppgId), getActiveSchool(targetSchoolId)]);

  if (school.sppgId !== sppg.id) {
    throw new AppError("School is not linked to the specified SPPG.", 400, "SCHOOL_SPPG_MISMATCH");
  }

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
      },
      include: distributionDetailInclude
    });

    await detectDistributionAnomalies({
      tx,
      distribution: updated,
      sppg,
      actorUserId,
      ipAddress
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "UPDATE",
      tableName: "distributions",
      recordId: updated.id,
      oldData: existing,
      newData: {
        ...updated,
        override: true,
        overrideReason: payload.overrideReason ?? null
      },
      ipAddress
    });

    if (!existing.isLocked && updated.isLocked) {
      await createAuditLog({
        prisma: tx,
        userId: actorUserId,
        action: "LOCK",
        tableName: "distributions",
        recordId: updated.id,
        oldData: existing,
        newData: updated,
        ipAddress
      });

      await createDistributionLockedNotification({
        tx,
        distribution: {
          ...updated,
          school
        }
      });
    }

    if (becameDelivered) {
      await createDeliveredNotification({
        tx,
        distribution: {
          ...updated,
          school
        }
      });
    }

    return updated;
  });

  return {
    data: distribution
  };
};

const listPriceThresholds = async ({ query }) => {
  const pagination = parsePagination(query);
  const where = {
    ...(query.province
      ? {
          province: {
            contains: query.province,
            mode: "insensitive"
          }
        }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.priceThreshold.findMany({
      where,
      include: {
        updatedByUser: {
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
      orderBy: [{ province: "asc" }]
    }),
    prisma.priceThreshold.count({ where })
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

const updatePriceThreshold = async ({ province, payload, actorUserId, ipAddress }) => {
  const normalizedProvince = province.trim();
  const existing = await prisma.priceThreshold.findFirst({
    where: {
      province: {
        equals: normalizedProvince,
        mode: "insensitive"
      }
    },
    include: {
      updatedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    }
  });

  const threshold = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.priceThreshold.update({
          where: {
            id: existing.id
          },
          data: {
            minPrice: payload.minPrice,
            maxPrice: payload.maxPrice,
            updatedBy: actorUserId
          },
          include: {
            updatedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        })
      : await tx.priceThreshold.create({
          data: {
            province: normalizedProvince,
            minPrice: payload.minPrice,
            maxPrice: payload.maxPrice,
            updatedBy: actorUserId
          },
          include: {
            updatedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: existing ? "UPDATE" : "INSERT",
      tableName: "price_thresholds",
      recordId: saved.id,
      oldData: existing,
      newData: saved,
      ipAddress
    });

    return saved;
  });

  return {
    data: threshold
  };
};

const listSystemConfigs = async ({ query }) => {
  const pagination = parsePagination(query);
  const where = buildTokenSearchWhere(query.search, ["key", "description"]);
  const include = {
    updatedByUser: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    }
  };

  if (hasSearchQuery(query.search)) {
    const candidateLimit = getRankedSearchCandidateLimit(pagination);
    let candidates = await prisma.systemConfig.findMany({
      where: buildRankedSearchCandidateWhere({}, query.search, ["key", "description"]),
      include,
      take: candidateLimit,
      orderBy: [{ key: "asc" }]
    });

    const ranked = paginateRankedSearch({
      items: candidates,
      query: query.search,
      fieldConfigs: [
        { field: "key", weight: 7 },
        { field: "description", weight: 2 }
      ],
      pagination
    });

    return {
      data: ranked.items,
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
    prisma.systemConfig.findMany({
      where,
      include,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ key: "asc" }]
    }),
    prisma.systemConfig.count({ where })
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

const getReadableSystemConfig = async ({ key }) => {
  if (key !== "export_max_rows") {
    throw new AppError("System config not found.", 404, "SYSTEM_CONFIG_NOT_FOUND");
  }

  const config = await prisma.systemConfig.upsert({
    where: {
      key
    },
    update: {},
    create: {
      key,
      value: DEFAULT_EXPORT_MAX_ROWS,
      description: "Maximum rows allowed for generated export files."
    }
  });

  return {
    data: config
  };
};

const updateSystemConfig = async ({ key, payload, actorUserId, ipAddress }) => {
  const normalizedKey = key.trim();
  const existing = await prisma.systemConfig.findUnique({
    where: {
      key: normalizedKey
    },
    include: {
      updatedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    }
  });

  const config = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.systemConfig.update({
          where: {
            id: existing.id
          },
          data: {
            value: payload.value,
            ...(payload.description !== undefined ? { description: payload.description } : {}),
            updatedBy: actorUserId
          },
          include: {
            updatedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        })
      : await tx.systemConfig.create({
          data: {
            key: normalizedKey,
            value: payload.value,
            description: payload.description ?? null,
            updatedBy: actorUserId
          },
          include: {
            updatedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: existing ? "UPDATE" : "INSERT",
      tableName: "system_configs",
      recordId: saved.id,
      oldData: existing,
      newData: saved,
      ipAddress
    });

    return saved;
  });

  return {
    data: config
  };
};

module.exports = {
  createUser,
  deleteUser,
  getAuditLogsSummary,
  getReadableSystemConfig,
  listAnomalyLogs,
  listAuditLogs,
  listPriceThresholds,
  listRoles,
  listSystemConfigs,
  listUsers,
  lockDistribution,
  overrideDistribution,
  restoreUser,
  resolveAnomalyLog,
  unlockDistribution,
  updatePriceThreshold,
  updateSystemConfig,
  updateUser
};
