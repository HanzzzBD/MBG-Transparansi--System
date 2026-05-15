const bcrypt = require("bcrypt");

const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const {
  BCRYPT_ROUNDS,
  generateRefreshToken,
  getRefreshTokenExpiresAt,
  hashRefreshToken,
  signAccessToken
} = require("../../utils/auth");

const prisma = getPrismaClient();

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;

const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  sppgId: true,
  schoolId: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true
};

const userAuthSelect = {
  id: true,
  name: true,
  email: true,
  password: true,
  role: true,
  sppgId: true,
  schoolId: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true
};

const normalizeEmail = (email) => email.trim().toLowerCase();

const serializeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  sppgId: user.sppgId ?? null,
  schoolId: user.schoolId ?? null,
  isActive: user.isActive,
  deletedAt: user.deletedAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const getLoginWindowStart = () => new Date(Date.now() - LOGIN_WINDOW_MS);

const getLockStateForEmail = async (prismaClient, email) => {
  const windowStart = getLoginWindowStart();

  const lastSuccess = await prismaClient.loginAttempt.findFirst({
    where: {
      email,
      success: true
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      createdAt: true
    }
  });

  const failureStart =
    lastSuccess?.createdAt && lastSuccess.createdAt > windowStart ? lastSuccess.createdAt : windowStart;

  const failures = await prismaClient.loginAttempt.findMany({
    where: {
      email,
      success: false,
      createdAt: {
        gte: failureStart
      }
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      id: true,
      createdAt: true
    }
  });

  if (failures.length < MAX_FAILED_LOGIN_ATTEMPTS) {
    return {
      failuresCount: failures.length,
      isLocked: false,
      lockedUntil: null
    };
  }

  const lastFailure = failures[failures.length - 1];
  const lockedUntil = new Date(lastFailure.createdAt.getTime() + LOGIN_WINDOW_MS);

  return {
    failuresCount: failures.length,
    isLocked: lockedUntil > new Date(),
    lockedUntil
  };
};

const createFailedLoginAttempt = async ({ email, ipAddress }) =>
  prisma.loginAttempt.create({
    data: {
      email,
      ipAddress: ipAddress || "unknown",
      success: false
    }
  });

const handleFailedLoginAttempt = async ({
  email,
  ipAddress,
  user = null,
  statusCode = 401,
  message = "Invalid email or password.",
  code = "INVALID_CREDENTIALS"
}) => {
  const failedAttempt = await createFailedLoginAttempt({ email, ipAddress });
  const updatedLockState = await getLockStateForEmail(prisma, email);

  if (updatedLockState.failuresCount === MAX_FAILED_LOGIN_ATTEMPTS) {
    await createAuditLog({
      prisma,
      userId: user?.id ?? null,
      action: "LOCK",
      tableName: user ? "users" : "login_attempts",
      recordId: user?.id ?? failedAttempt.id,
      newData: {
        email,
        lockedUntil: updatedLockState.lockedUntil,
        triggerAttemptId: failedAttempt.id
      },
      ipAddress
    });

    throw new AppError(
      "Too many failed login attempts. Please try again after 15 minutes.",
      429,
      "LOGIN_TEMPORARILY_LOCKED",
      {
        lockedUntil: updatedLockState.lockedUntil
      }
    );
  }

  throw new AppError(message, statusCode, code);
};

const register = async ({ actorUserId, name, email, password, role, sppgId, schoolId, ipAddress }) => {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    },
    select: {
      id: true
    }
  });

  if (existingUser) {
    throw new AppError("A user with this email already exists.", 409, "EMAIL_ALREADY_EXISTS");
  }

  if (sppgId) {
    const sppg = await prisma.sppg.findFirst({
      where: {
        id: sppgId,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!sppg) {
      throw new AppError("SPPG not found.", 404, "SPPG_NOT_FOUND");
    }
  }

  if (schoolId) {
    const school = await prisma.school.findFirst({
      where: {
        id: schoolId,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!school) {
      throw new AppError("School not found.", 404, "SCHOOL_NOT_FOUND");
    }
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role,
        sppgId: sppgId ?? null,
        schoolId: schoolId ?? null
      },
      select: userPublicSelect
    });

    await createAuditLog({
      prisma: tx,
      userId: actorUserId,
      action: "INSERT",
      tableName: "users",
      recordId: createdUser.id,
      newData: createdUser,
      ipAddress
    });

    return createdUser;
  });

  return {
    user: serializeUser(user)
  };
};

const login = async ({ email, password, ipAddress, userAgent }) => {
  const normalizedEmail = normalizeEmail(email);
  const currentLockState = await getLockStateForEmail(prisma, normalizedEmail);

  if (currentLockState.isLocked) {
    throw new AppError(
      "Too many failed login attempts. Please try again after 15 minutes.",
      429,
      "LOGIN_TEMPORARILY_LOCKED",
      {
        lockedUntil: currentLockState.lockedUntil
      }
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    },
    select: userAuthSelect
  });

  if (!user) {
    await handleFailedLoginAttempt({
      email: normalizedEmail,
      ipAddress
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    await handleFailedLoginAttempt({
      email: normalizedEmail,
      ipAddress,
      user
    });
  }

  if (!user.isActive || user.deletedAt) {
    await handleFailedLoginAttempt({
      email: normalizedEmail,
      ipAddress,
      user,
      statusCode: 403,
      message: "This account is inactive.",
      code: "ACCOUNT_INACTIVE"
    });
  }

  const refreshToken = generateRefreshToken();
  const hashedRefreshToken = hashRefreshToken(refreshToken);
  const sessionExpiresAt = getRefreshTokenExpiresAt();
  const accessToken = signAccessToken(user);

  await prisma.$transaction(async (tx) => {
    await tx.loginAttempt.create({
      data: {
        email: normalizedEmail,
        ipAddress: ipAddress || "unknown",
        success: true
      }
    });

    const session = await tx.userSession.create({
      data: {
        userId: user.id,
        refreshToken: hashedRefreshToken,
        userAgent,
        ipAddress,
        expiresAt: sessionExpiresAt
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: user.id,
      action: "LOGIN",
      tableName: "users",
      recordId: user.id,
      newData: {
        sessionId: session.id,
        expiresAt: session.expiresAt,
        userAgent
      },
      ipAddress
    });
  });

  return {
    accessToken,
    refreshToken,
    user: serializeUser(user)
  };
};

const refresh = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new AppError("Refresh token is required.", 401, "REFRESH_TOKEN_MISSING");
  }

  const hashedRefreshToken = hashRefreshToken(refreshToken);
  const session = await prisma.userSession.findUnique({
    where: {
      refreshToken: hashedRefreshToken
    },
    include: {
      user: {
        select: userAuthSelect
      }
    }
  });

  if (!session || session.isRevoked || session.expiresAt <= new Date()) {
    throw new AppError("Refresh token is invalid or expired.", 401, "REFRESH_TOKEN_INVALID");
  }

  if (!session.user || !session.user.isActive || session.user.deletedAt) {
    throw new AppError("Authenticated user was not found.", 401, "AUTH_USER_NOT_FOUND");
  }

  return {
    accessToken: signAccessToken(session.user),
    user: serializeUser(session.user)
  };
};

const logout = async ({ refreshToken, ipAddress }) => {
  if (!refreshToken) {
    return { success: true };
  }

  const hashedRefreshToken = hashRefreshToken(refreshToken);
  const session = await prisma.userSession.findUnique({
    where: {
      refreshToken: hashedRefreshToken
    },
    include: {
      user: {
        select: userPublicSelect
      }
    }
  });

  if (!session) {
    return { success: true };
  }

  if (session.isRevoked) {
    return { success: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.userSession.update({
      where: {
        id: session.id
      },
      data: {
        isRevoked: true
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: session.userId,
      action: "LOGOUT",
      tableName: "users",
      recordId: session.userId,
      newData: {
        sessionId: session.id
      },
      ipAddress
    });
  });

  return { success: true };
};

const getMe = async ({ userId }) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      deletedAt: null
    },
    select: userPublicSelect
  });

  if (!user) {
    throw new AppError("Authenticated user was not found.", 401, "AUTH_USER_NOT_FOUND");
  }

  return {
    user: serializeUser(user)
  };
};

module.exports = {
  getMe,
  login,
  logout,
  refresh,
  register
};
