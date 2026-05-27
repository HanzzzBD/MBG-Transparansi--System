const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");

const prisma = getPrismaClient();

const serializeNotification = (notification) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  payload: notification.payload,
  isRead: notification.isRead,
  is_read: notification.isRead,
  readAt: notification.readAt,
  read_at: notification.readAt,
  createdAt: notification.createdAt,
  created_at: notification.createdAt,
  updatedAt: notification.updatedAt,
  updated_at: notification.updatedAt
});

const getOwnedNotification = async ({ id, userId }) => {
  const notification = await prisma.notification.findFirst({
    where: {
      id: Number(id),
      userId: Number(userId)
    }
  });

  if (!notification) {
    throw new AppError("Notification not found.", 404, "NOTIFICATION_NOT_FOUND");
  }

  return notification;
};

const listNotifications = async ({ query, user }) => {
  const pagination = parsePagination(query);
  const where = {
    userId: user.userId,
    ...(query.is_read !== undefined ? { isRead: query.is_read } : {}),
    ...(query.type ? { type: query.type } : {})
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: {
        userId: user.userId,
        isRead: false
      }
    })
  ]);

  return {
    data: items.map(serializeNotification),
    meta: {
      ...buildPaginationMeta({
        page: pagination.page,
        limit: pagination.limit,
        total
      }),
      unreadCount
    }
  };
};

const markNotificationAsRead = async ({ id, user, ipAddress }) => {
  const existing = await getOwnedNotification({
    id,
    userId: user.userId
  });

  if (existing.isRead) {
    return {
      data: existing
    };
  }

  const notification = await prisma.$transaction(async (tx) => {
    const updated = await tx.notification.update({
      where: {
        id: existing.id
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "UPDATE",
      tableName: "notifications",
      recordId: updated.id,
      oldData: existing,
      newData: updated,
      ipAddress
    });

    return updated;
  });

  return {
    data: serializeNotification(notification)
  };
};

const markAllNotificationsAsRead = async ({ user, ipAddress }) => {
  const unreadNotifications = await prisma.notification.findMany({
    where: {
      userId: user.userId,
      isRead: false
    },
    select: {
      id: true
    }
  });

  if (unreadNotifications.length === 0) {
    return {
      data: {
        updatedCount: 0
      }
    };
  }

  const unreadIds = unreadNotifications.map((notification) => notification.id);
  const readAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.notification.updateMany({
      where: {
        id: {
          in: unreadIds
        }
      },
      data: {
        isRead: true,
        readAt
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "UPDATE",
      tableName: "notifications",
      recordId: user.userId,
      oldData: {
        unreadCount: unreadIds.length
      },
      newData: {
        updatedCount: unreadIds.length,
        readAt
      },
      ipAddress
    });
  });

  return {
    data: {
      updatedCount: unreadIds.length
    }
  };
};

module.exports = {
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead
};
