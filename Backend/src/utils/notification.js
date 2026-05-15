const { emitToUser } = require("./socket");

const createNotificationsForUsers = async ({
  prisma,
  userIds,
  type,
  title,
  message,
  payload = null,
  eventName = null,
  eventPayload = null
}) => {
  const uniqueUserIds = [...new Set((userIds || []).map((id) => Number(id)).filter(Boolean))];

  if (uniqueUserIds.length === 0) {
    return [];
  }

  const notifications = await Promise.all(
    uniqueUserIds.map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          payload
        }
      })
    )
  );

  if (eventName) {
    notifications.forEach((notification) => {
      emitToUser(notification.userId, eventName, {
        notification,
        payload: eventPayload ?? payload
      });
    });
  }

  return notifications;
};

const findUserIdsBySchoolId = async (prisma, schoolId) => {
  const users = await prisma.user.findMany({
    where: {
      role: "sekolah",
      schoolId: Number(schoolId),
      isActive: true,
      deletedAt: null
    },
    select: {
      id: true
    }
  });

  return users.map((user) => user.id);
};

const findUserIdsBySppgId = async (prisma, sppgId) => {
  const users = await prisma.user.findMany({
    where: {
      role: "sppg",
      sppgId: Number(sppgId),
      isActive: true,
      deletedAt: null
    },
    select: {
      id: true
    }
  });

  return users.map((user) => user.id);
};

const findUserIdsByRoles = async (prisma, roles) => {
  const normalizedRoles = [...new Set((roles || []).filter(Boolean))];

  if (normalizedRoles.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      role: {
        in: normalizedRoles
      },
      isActive: true,
      deletedAt: null
    },
    select: {
      id: true
    }
  });

  return users.map((user) => user.id);
};

module.exports = {
  createNotificationsForUsers,
  findUserIdsByRoles,
  findUserIdsBySchoolId,
  findUserIdsBySppgId
};
