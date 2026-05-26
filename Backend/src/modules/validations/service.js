const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAnomalyIfNeeded } = require("../../utils/anomaly");
const { createAuditLog } = require("../../utils/auditLog");
const { assertSchoolOwnership, requireSchoolScope } = require("../../utils/ownership");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");
const {
  createNotificationsForUsers,
  findUserIdsByRoles,
  findUserIdsBySppgId
} = require("../../utils/notification");

const prisma = getPrismaClient();

const buildValidationWhere = ({ query = {}, user }) => {
  const where = {
    school: {
      deletedAt: null
    },
    distribution: {
      school: {
        deletedAt: null
      },
      sppg: {
        deletedAt: null
      }
    },
    ...(query.status ? { status: query.status } : {})
  };

  if (user.role === "sekolah") {
    where.schoolId = requireSchoolScope(user);
    return where;
  }

  if (query.schoolId) {
    where.schoolId = Number(query.schoolId);
  }

  return where;
};

const getValidationById = async (id) => {
  const validation = await prisma.validation.findUnique({
    where: {
      id: Number(id)
    },
    include: {
      school: {
        include: {
          sppg: true
        }
      },
      distribution: {
        include: {
          sppg: true,
          school: true,
          proofs: {
            include: {
              file: true
            }
          }
        }
      }
    }
  });

  if (!validation) {
    throw new AppError("Validation not found.", 404, "VALIDATION_NOT_FOUND");
  }

  if (validation.school?.deletedAt) {
    throw new AppError("Validation school is no longer active.", 404, "SCHOOL_NOT_FOUND");
  }

  if (validation.distribution?.school?.deletedAt || validation.distribution?.sppg?.deletedAt) {
    throw new AppError("Validation distribution references inactive records.", 404, "DISTRIBUTION_SCOPE_INVALID");
  }

  return validation;
};

const createValidationNotification = async ({ tx, validation, status }) => {
  const sppgUserIds = await findUserIdsBySppgId(tx, validation.distribution.sppgId);

  await createNotificationsForUsers({
    prisma: tx,
    userIds: sppgUserIds,
    type: "validation",
    title: "Validasi Distribusi Diperbarui",
    message: `Validasi distribusi #${validation.distributionId} diperbarui menjadi ${status}.`,
    payload: {
      validationId: validation.id,
      distributionId: validation.distributionId,
      schoolId: validation.schoolId,
      sppgId: validation.distribution.sppgId,
      status
    }
  });
};

const createValidationConflictNotification = async ({ tx, validation }) => {
  const governmentAndAdminUserIds = await findUserIdsByRoles(tx, ["pemerintah", "admin"]);

  await createNotificationsForUsers({
    prisma: tx,
    userIds: governmentAndAdminUserIds,
    type: "validation",
    title: "Validasi Konflik",
    message: `Validasi distribusi #${validation.distributionId} ditandai conflict oleh sekolah.`,
    payload: {
      validationId: validation.id,
      distributionId: validation.distributionId,
      schoolId: validation.schoolId,
      sppgId: validation.distribution.sppgId,
      status: "conflict"
    },
    eventName: "validation:conflict",
    eventPayload: {
      validationId: validation.id,
      distributionId: validation.distributionId,
      schoolId: validation.schoolId,
      sppgId: validation.distribution.sppgId,
      status: "conflict"
    }
  });
};

const listValidations = async ({ query, user }) => {
  const pagination = parsePagination(query);
  const where = buildValidationWhere({ query, user });

  const [items, total] = await Promise.all([
    prisma.validation.findMany({
      where,
      include: {
        school: {
          include: {
            sppg: true
          }
        },
        distribution: {
          include: {
            sppg: true,
            school: true
          }
        }
      },
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.validation.count({ where })
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

const getValidationDetail = async ({ id, user }) => {
  const validation = await getValidationById(id);

  if (user.role === "sekolah") {
    assertSchoolOwnership(user, validation.schoolId);
  }

  return {
    data: validation
  };
};

const updateValidation = async ({ id, payload, user, ipAddress }) => {
  const existing = await getValidationById(id);

  if (user.role === "sekolah") {
    assertSchoolOwnership(user, existing.schoolId);
  }

  const nextStatus = payload.status ?? existing.status;

  const validation = await prisma.$transaction(async (tx) => {
    const updated = await tx.validation.update({
      where: {
        id: existing.id
      },
      data: {
        ...(payload.receivedPortions !== undefined ? { receivedPortions: payload.receivedPortions } : {}),
        ...(payload.qualityOk !== undefined ? { qualityOk: payload.qualityOk } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
        ...(payload.status !== undefined
          ? {
              validatedAt: nextStatus === "pending" ? null : new Date()
            }
          : {})
      },
      include: {
        school: {
          include: {
            sppg: true
          }
        },
        distribution: {
          include: {
            sppg: true,
            school: true,
            proofs: {
              include: {
                file: true
              }
            }
          }
        }
      }
    });

    const hasPortionConflict = Number(updated.receivedPortions) !== Number(updated.distribution.portions);
    const hasQualityConflict = updated.qualityOk === false;

    if (nextStatus !== "pending" && (nextStatus === "conflict" || hasPortionConflict || hasQualityConflict)) {
      await createAnomalyIfNeeded({
        prisma: tx,
        distributionId: updated.distributionId,
        anomalyType: "VALIDATION_CONFLICT",
        description: `School validation conflict for distribution #${updated.distributionId}: received ${updated.receivedPortions} of ${updated.distribution.portions} portions, qualityOk=${updated.qualityOk}.`,
        actorUserId: user.userId,
        ipAddress
      });
    }

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "UPDATE",
      tableName: "validations",
      recordId: updated.id,
      oldData: existing,
      newData: updated,
      ipAddress
    });

    await createValidationNotification({
      tx,
      validation: updated,
      status: nextStatus
    });

    if (existing.status !== "conflict" && nextStatus === "conflict") {
      await createValidationConflictNotification({
        tx,
        validation: updated
      });
    }

    return updated;
  });

  return {
    data: validation
  };
};

module.exports = {
  getValidationDetail,
  listValidations,
  updateValidation
};
