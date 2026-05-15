const { Server } = require("socket.io");

const { getPrismaClient } = require("../config/prisma");
const { clientOrigins } = require("../config/env");
const { extractBearerToken, verifyAccessToken } = require("./auth");

const prisma = getPrismaClient();

let ioInstance;

const getUserRoom = (userId) => `user:${Number(userId)}`;

const extractSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token || socket.handshake.auth?.accessToken;

  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.trim();
  }

  return extractBearerToken(socket.handshake.headers?.authorization);
};

const initializeSocketServer = (httpServer) => {
  if (ioInstance) {
    return ioInstance;
  }

  ioInstance = new Server(httpServer, {
    cors: {
      origin: clientOrigins,
      credentials: true
    }
  });

  ioInstance.use(async (socket, next) => {
    try {
      const token = extractSocketToken(socket);

      if (!token) {
        return next(new Error("Socket authentication token is required."));
      }

      let payload;

      try {
        payload = verifyAccessToken(token);
      } catch (_error) {
        return next(new Error("Socket authentication token is invalid."));
      }

      const user = await prisma.user.findFirst({
        where: {
          id: payload.user_id,
          email: payload.email,
          role: payload.role,
          isActive: true,
          deletedAt: null
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          sppgId: true,
          schoolId: true
        }
      });

      if (!user) {
        return next(new Error("Authenticated socket user was not found."));
      }

      socket.user = user;

      return next();
    } catch (error) {
      return next(error);
    }
  });

  ioInstance.on("connection", (socket) => {
    socket.join(getUserRoom(socket.user.id));

    socket.emit("socket:ready", {
      userId: socket.user.id
    });
  });

  return ioInstance;
};

const getSocketServer = () => ioInstance;

const emitToUser = (userId, eventName, payload) => {
  if (!ioInstance) {
    return;
  }

  ioInstance.to(getUserRoom(userId)).emit(eventName, payload);
};

const emitToUsers = (userIds, eventName, payload) => {
  [...new Set((userIds || []).map((id) => Number(id)).filter(Boolean))].forEach((userId) => {
    emitToUser(userId, eventName, payload);
  });
};

const shutdownSocketServer = async () => {
  if (!ioInstance) {
    return;
  }

  await ioInstance.close();
  ioInstance = null;
};

module.exports = {
  emitToUser,
  emitToUsers,
  getSocketServer,
  getUserRoom,
  initializeSocketServer,
  shutdownSocketServer
};
