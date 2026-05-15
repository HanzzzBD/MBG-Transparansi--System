const AppError = require("../utils/appError");
const { getPrismaClient } = require("../config/prisma");
const { extractBearerToken, verifyAccessToken } = require("../utils/auth");

const prisma = getPrismaClient();

const authenticate = async (req, _res, next) => {
  try {
    const token = extractBearerToken(req.get("authorization"));

    if (!token) {
      throw new AppError("Access token is required.", 401, "AUTH_TOKEN_MISSING");
    }

    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new AppError("Access token has expired.", 401, "AUTH_TOKEN_EXPIRED");
      }

      throw new AppError("Access token is invalid.", 401, "AUTH_TOKEN_INVALID");
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
        schoolId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new AppError("Authenticated user was not found.", 401, "AUTH_USER_NOT_FOUND");
    }

    req.user = {
      ...user,
      userId: user.id
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticate
};
