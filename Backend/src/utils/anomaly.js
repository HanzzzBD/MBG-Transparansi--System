const { createAuditLog } = require("./auditLog");
const {
  createNotificationsForUsers,
  findUserIdsByRoles
} = require("./notification");

const createAnomalyIfNeeded = async ({
  prisma,
  distributionId,
  anomalyType,
  description,
  actorUserId = null,
  ipAddress = null,
  notificationTitle,
  notificationMessage,
  notificationPayload
}) => {
  const existing = await prisma.anomalyLog.findFirst({
    where: {
      distributionId,
      anomalyType,
      isResolved: false
    },
    select: {
      id: true
    }
  });

  if (existing) {
    return {
      anomaly: existing,
      created: false
    };
  }

  const anomaly = await prisma.anomalyLog.create({
    data: {
      distributionId,
      anomalyType,
      description
    }
  });

  await createAuditLog({
    prisma,
    userId: actorUserId,
    action: "INSERT",
    tableName: "anomaly_logs",
    recordId: anomaly.id,
    newData: anomaly,
    ipAddress
  });

  const recipientUserIds = await findUserIdsByRoles(prisma, ["admin", "pemerintah"]);

  await createNotificationsForUsers({
    prisma,
    userIds: recipientUserIds,
    type: "anomaly",
    title: notificationTitle || "Anomali Terdeteksi",
    message: notificationMessage || description,
    payload: {
      anomalyId: anomaly.id,
      distributionId,
      anomalyType,
      description,
      ...(notificationPayload || {})
    },
    eventName: "anomaly:detected",
    eventPayload: {
      anomalyId: anomaly.id,
      distributionId,
      anomalyType,
      description,
      ...(notificationPayload || {})
    }
  });

  return {
    anomaly,
    created: true
  };
};

module.exports = {
  createAnomalyIfNeeded
};
