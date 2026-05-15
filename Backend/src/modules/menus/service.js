const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { assertSppgOwnership, requireSppgScope } = require("../../utils/ownership");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");

const prisma = getPrismaClient();

const buildMenuWhere = (query = {}) => ({
  deletedAt: null,
  sppg: {
    deletedAt: null
  },
  ...(query.sppgId ? { sppgId: Number(query.sppgId) } : {}),
  ...(query.date ? { menuDate: new Date(query.date) } : {})
});

const getActiveSppg = async (id) => {
  const sppg = await prisma.sppg.findFirst({
    where: {
      id: Number(id),
      deletedAt: null
    },
    select: {
      id: true
    }
  });

  if (!sppg) {
    throw new AppError("SPPG not found.", 404, "SPPG_NOT_FOUND");
  }

  return sppg;
};

const getActiveMenuById = async (id) => {
  const menu = await prisma.menu.findFirst({
    where: {
      id: Number(id),
      deletedAt: null,
      sppg: {
        deletedAt: null
      }
    },
    include: {
      sppg: true
    }
  });

  if (!menu) {
    throw new AppError("Menu not found.", 404, "MENU_NOT_FOUND");
  }

  return menu;
};

const listMenus = async ({ query }) => {
  const pagination = parsePagination(query);
  const where = buildMenuWhere(query);

  const [items, total] = await Promise.all([
    prisma.menu.findMany({
      where,
      include: {
        sppg: true
      },
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ menuDate: "desc" }, { createdAt: "desc" }]
    }),
    prisma.menu.count({ where })
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

const createMenu = async ({ payload, user, ipAddress }) => {
  const targetSppgId = user.role === "sppg" ? requireSppgScope(user) : payload.sppgId;

  if (!targetSppgId) {
    throw new AppError("sppgId is required.", 400, "SPPG_ID_REQUIRED");
  }

  if (user.role === "sppg") {
    assertSppgOwnership(user, targetSppgId);
  }

  await getActiveSppg(targetSppgId);

  const menu = await prisma.$transaction(async (tx) => {
    const created = await tx.menu.create({
      data: {
        sppgId: targetSppgId,
        menuDate: new Date(payload.menuDate),
        menuName: payload.menuName.trim(),
        calories: payload.calories ?? null,
        proteinG: payload.proteinG ?? null,
        carbsG: payload.carbsG ?? null,
        fatG: payload.fatG ?? null
      },
      include: {
        sppg: true
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "INSERT",
      tableName: "menus",
      recordId: created.id,
      newData: created,
      ipAddress
    });

    return created;
  });

  return {
    data: menu
  };
};

const updateMenu = async ({ id, payload, user, ipAddress }) => {
  const existing = await getActiveMenuById(id);

  if (user.role === "sppg") {
    assertSppgOwnership(user, existing.sppgId);
  }

  if (payload.sppgId !== undefined) {
    if (user.role === "sppg") {
      assertSppgOwnership(user, payload.sppgId);
    }

    await getActiveSppg(payload.sppgId);
  }

  const menu = await prisma.$transaction(async (tx) => {
    const updated = await tx.menu.update({
      where: {
        id: existing.id
      },
      data: {
        ...(payload.sppgId !== undefined ? { sppgId: payload.sppgId } : {}),
        ...(payload.menuDate !== undefined ? { menuDate: new Date(payload.menuDate) } : {}),
        ...(payload.menuName !== undefined ? { menuName: payload.menuName.trim() } : {}),
        ...(payload.calories !== undefined ? { calories: payload.calories } : {}),
        ...(payload.proteinG !== undefined ? { proteinG: payload.proteinG } : {}),
        ...(payload.carbsG !== undefined ? { carbsG: payload.carbsG } : {}),
        ...(payload.fatG !== undefined ? { fatG: payload.fatG } : {})
      },
      include: {
        sppg: true
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "UPDATE",
      tableName: "menus",
      recordId: updated.id,
      oldData: existing,
      newData: updated,
      ipAddress
    });

    return updated;
  });

  return {
    data: menu
  };
};

const deleteMenu = async ({ id, user, ipAddress }) => {
  const existing = await getActiveMenuById(id);

  const menu = await prisma.$transaction(async (tx) => {
    const updated = await tx.menu.update({
      where: {
        id: existing.id
      },
      data: {
        deletedAt: new Date()
      },
      include: {
        sppg: true
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "DELETE",
      tableName: "menus",
      recordId: updated.id,
      oldData: existing,
      newData: updated,
      ipAddress
    });

    return updated;
  });

  return {
    data: menu
  };
};

module.exports = {
  createMenu,
  deleteMenu,
  listMenus,
  updateMenu
};
