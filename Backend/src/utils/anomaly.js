const { createAuditLog } = require("./auditLog");
const {
  createNotificationsForUsers,
  findUserIdsByRoles
} = require("./notification");

const createAnomalyIfNeeded = async ({
  prisma,
  distributionId = null,
  productionBatchId = null,
  productionBatchItemId = null,
  anomalyType,
  description,
  metadata = null,
  actorUserId = null,
  ipAddress = null,
  notificationTitle,
  notificationMessage,
  notificationPayload
}) => {
  const scopeWhere = {
    ...(distributionId ? { distributionId } : {}),
    ...(productionBatchId ? { productionBatchId } : {}),
    ...(productionBatchItemId ? { productionBatchItemId } : {})
  };

  const existing = await prisma.anomalyLog.findFirst({
    where: {
      ...scopeWhere,
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
      productionBatchId,
      productionBatchItemId,
      anomalyType,
      description,
      metadata
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
      productionBatchId,
      productionBatchItemId,
      anomalyType,
      description,
      metadata,
      ...(notificationPayload || {})
    },
    eventName: "anomaly:detected",
    eventPayload: {
      anomalyId: anomaly.id,
      distributionId,
      productionBatchId,
      productionBatchItemId,
      anomalyType,
      description,
      metadata,
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
