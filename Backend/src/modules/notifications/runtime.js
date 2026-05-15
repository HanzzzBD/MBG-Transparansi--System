const cron = require("node-cron");

const { getPrismaClient } = require("../../config/prisma");
const { createAnomalyIfNeeded } = require("../../utils/anomaly");
const { createAuditLog } = require("../../utils/auditLog");
const {
  createNotificationsForUsers,
  findUserIdsByRoles,
  findUserIdsBySppgId
} = require("../../utils/notification");
const { getNumberSystemConfig } = require("../../utils/systemConfig");

const prisma = getPrismaClient();

const DEFAULT_VALIDATION_TIMEOUT_HOURS = 24;
const DEFAULT_AUTO_LOCK_AFTER_HOURS = 24;
const HOURLY_CRON_EXPRESSION = "0 * * * *";

let validationTimeoutTask;
let autoLockTask;

const createDistributionLockedNotification = async ({ tx, distribution }) => {
  const sppgUserIds = await findUserIdsBySppgId(tx, distribution.sppgId);

  await createNotificationsForUsers({
    prisma: tx,
    userIds: sppgUserIds,
    type: "system",
    title: "Distribusi Dikunci",
    message: `Distribusi #${distribution.id} untuk sekolah ${distribution.school.name} telah dikunci otomatis.`,
    payload: {
      distributionId: distribution.id,
      schoolId: distribution.schoolId,
      sppgId: distribution.sppgId,
      isLocked: true,
      source: "cron"
    },
    eventName: "distribution:locked",
    eventPayload: {
      distributionId: distribution.id,
      schoolId: distribution.schoolId,
      sppgId: distribution.sppgId,
      isLocked: true,
      source: "cron"
    }
  });
};

const runValidationTimeoutJob = async () => {
  const timeoutHours = await getNumberSystemConfig(
    prisma,
    "validation_timeout_hours",
    DEFAULT_VALIDATION_TIMEOUT_HOURS
  );
  const cutoffDate = new Date(Date.now() - timeoutHours * 60 * 60 * 1000);
  const candidates = await prisma.validation.findMany({
    where: {
      status: "pending",
      school: {
        deletedAt: null
      },
      distribution: {
        status: "delivered",
        updatedAt: {
          lte: cutoffDate
        },
        sppg: {
          deletedAt: null
        },
        school: {
          deletedAt: null
        }
      }
    },
    select: {
      id: true
    }
  });

  let processedCount = 0;

  for (const candidate of candidates) {
    const didProcess = await prisma.$transaction(async (tx) => {
      const validation = await tx.validation.findUnique({
        where: {
          id: candidate.id
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
              school: true
            }
          }
        }
      });

      if (
        !validation ||
        validation.status !== "pending" ||
        validation.school?.deletedAt ||
        validation.distribution?.status !== "delivered" ||
        validation.distribution?.updatedAt > cutoffDate ||
        validation.distribution?.sppg?.deletedAt ||
        validation.distribution?.school?.deletedAt
      ) {
        return false;
      }

      const anomalyResult = await createAnomalyIfNeeded({
        prisma: tx,
        distributionId: validation.distributionId,
        anomalyType: "PENDING_TIMEOUT",
        description: `Validation for distribution #${validation.distributionId} has been pending for more than ${timeoutHours} hours.`,
        notificationPayload: {
          validationId: validation.id,
          schoolId: validation.schoolId,
          sppgId: validation.distribution.sppgId,
          timeoutHours
        }
      });

      if (!anomalyResult.created) {
        return false;
      }

      const [sppgUserIds, adminUserIds] = await Promise.all([
        findUserIdsBySppgId(tx, validation.distribution.sppgId),
        findUserIdsByRoles(tx, ["admin"])
      ]);

      await createNotificationsForUsers({
        prisma: tx,
        userIds: [...sppgUserIds, ...adminUserIds],
        type: "validation",
        title: "Validasi Melebihi Batas Waktu",
        message: `Validasi distribusi #${validation.distributionId} masih pending lebih dari ${timeoutHours} jam.`,
        payload: {
          validationId: validation.id,
          distributionId: validation.distributionId,
          schoolId: validation.schoolId,
          sppgId: validation.distribution.sppgId,
          timeoutHours
        },
        eventName: "validation:timeout",
        eventPayload: {
          validationId: validation.id,
          distributionId: validation.distributionId,
          schoolId: validation.schoolId,
          sppgId: validation.distribution.sppgId,
          timeoutHours
        }
      });

      return true;
    });

    if (didProcess) {
      processedCount += 1;
    }
  }

  return processedCount;
};

const runAutoLockJob = async () => {
  const autoLockAfterHours = await getNumberSystemConfig(
    prisma,
    "auto_lock_after_hours",
    DEFAULT_AUTO_LOCK_AFTER_HOURS
  );
  const now = new Date();
  const cutoffDate = new Date(Date.now() - autoLockAfterHours * 60 * 60 * 1000);
  const candidates = await prisma.distribution.findMany({
    where: {
      isLocked: false,
      OR: [
        {
          unlockedUntil: null
        },
        {
          unlockedUntil: {
            lte: now
          }
        }
      ],
      createdAt: {
        lte: cutoffDate
      },
      sppg: {
        deletedAt: null
      },
      school: {
        deletedAt: null
      }
    },
    select: {
      id: true
    }
  });

  let processedCount = 0;

  for (const candidate of candidates) {
    const didProcess = await prisma.$transaction(async (tx) => {
      const distribution = await tx.distribution.findUnique({
        where: {
          id: candidate.id
        },
        include: {
          sppg: true,
          school: true
        }
      });

      if (
        !distribution ||
        distribution.isLocked ||
        (distribution.unlockedUntil && distribution.unlockedUntil > now) ||
        distribution.createdAt > cutoffDate ||
        distribution.sppg?.deletedAt ||
        distribution.school?.deletedAt
      ) {
        return false;
      }

      const updated = await tx.distribution.update({
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
        recordId: updated.id,
        oldData: {
          isLocked: distribution.isLocked,
          unlockedUntil: distribution.unlockedUntil
        },
        newData: {
          isLocked: updated.isLocked,
          unlockedUntil: updated.unlockedUntil
        }
      });

      await createDistributionLockedNotification({
        tx,
        distribution: updated
      });

      return true;
    });

    if (didProcess) {
      processedCount += 1;
    }
  }

  return processedCount;
};

const initializeNotificationRuntime = () => {
  if (!validationTimeoutTask) {
    validationTimeoutTask = cron.schedule(
      HOURLY_CRON_EXPRESSION,
      async () => {
        try {
          await runValidationTimeoutJob();
        } catch (error) {
          console.error("Validation timeout job failed:", error);
        }
      },
      {
        timezone: "Asia/Jakarta"
      }
    );
  }

  if (!autoLockTask) {
    autoLockTask = cron.schedule(
      HOURLY_CRON_EXPRESSION,
      async () => {
        try {
          await runAutoLockJob();
        } catch (error) {
          console.error("Auto-lock job failed:", error);
        }
      },
      {
        timezone: "Asia/Jakarta"
      }
    );
  }
};

const shutdownNotificationRuntime = () => {
  if (validationTimeoutTask) {
    validationTimeoutTask.stop();
    validationTimeoutTask = null;
  }

  if (autoLockTask) {
    autoLockTask.stop();
    autoLockTask = null;
  }
};

module.exports = {
  initializeNotificationRuntime,
  runAutoLockJob,
  runValidationTimeoutJob,
  shutdownNotificationRuntime
};
