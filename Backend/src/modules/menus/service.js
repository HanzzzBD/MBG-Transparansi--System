const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { assertSppgOwnership, requireSppgScope } = require("../../utils/ownership");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");

const prisma = getPrismaClient();

const menuInclude = {
  sppg: true,
  photoFile: true,
  priceValidator: {
    select: {
      id: true,
      name: true,
      email: true
    }
  }
};

const decorateMenu = (menu) => menu
  ? {
      ...menu,
      manualPricePerPortion: menu.manualPricePerPortion === null || menu.manualPricePerPortion === undefined
        ? menu.manualPricePerPortion
        : Number(menu.manualPricePerPortion)
    }
  : menu;

const buildMenuWhere = ({ query = {}, user } = {}) => {
  const where = {
    deletedAt: null,
    sppg: {
      deletedAt: null
    },
    ...(query.sppgId ? { sppgId: Number(query.sppgId) } : {}),
    ...(query.date ? { menuDate: new Date(query.date) } : {}),
    ...(query.priceValidationStatus ? { priceValidationStatus: query.priceValidationStatus } : {})
  };

  if (user?.role === "sppg") {
    where.sppgId = requireSppgScope(user);
  }

  return where;
};

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
    include: menuInclude
  });

  if (!menu) {
    throw new AppError("Menu not found.", 404, "MENU_NOT_FOUND");
  }

  return menu;
};

const listMenus = async ({ query, user }) => {
  const pagination = parsePagination(query);
  const where = buildMenuWhere({ query, user });

  const [items, total] = await Promise.all([
    prisma.menu.findMany({
      where,
      include: menuInclude,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ menuDate: "desc" }, { createdAt: "desc" }]
    }),
    prisma.menu.count({ where })
  ]);

  return {
    data: items.map(decorateMenu),
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
        items: payload.items || [],
        photoFileId: payload.photoFileId ?? null,
        manualPricePerPortion: payload.manualPricePerPortion ?? null,
        priceValidationStatus: "PENDING_REVIEW",
        priceValidationNotes: null,
        priceValidatedAt: null,
        priceValidatedBy: null,
        calories: payload.calories ?? null,
        proteinG: payload.proteinG ?? null,
        carbsG: payload.carbsG ?? null,
        fatG: payload.fatG ?? null
      },
      include: menuInclude
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
    data: decorateMenu(menu)
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
        ...(payload.items !== undefined ? { items: payload.items || [] } : {}),
        ...(payload.photoFileId !== undefined ? { photoFileId: payload.photoFileId } : {}),
        ...(payload.manualPricePerPortion !== undefined
          ? {
              manualPricePerPortion: payload.manualPricePerPortion,
              priceValidationStatus: "PENDING_REVIEW",
              priceValidationNotes: null,
              priceValidatedAt: null,
              priceValidatedBy: null
            }
          : {}),
        ...(payload.calories !== undefined ? { calories: payload.calories } : {}),
        ...(payload.proteinG !== undefined ? { proteinG: payload.proteinG } : {}),
        ...(payload.carbsG !== undefined ? { carbsG: payload.carbsG } : {}),
        ...(payload.fatG !== undefined ? { fatG: payload.fatG } : {})
      },
      include: menuInclude
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
    data: decorateMenu(menu)
  };
};

const validateMenuPrice = async ({ id, payload, user, ipAddress }) => {
  const existing = await getActiveMenuById(id);

  if (user.role === "sppg") {
    assertSppgOwnership(user, existing.sppgId);
  }

  const menu = await prisma.$transaction(async (tx) => {
    const updated = await tx.menu.update({
      where: {
        id: existing.id
      },
      data: {
        priceValidationStatus: payload.status,
        priceValidationNotes: payload.notes?.trim() || null,
        priceValidatedAt: new Date(),
        priceValidatedBy: user.userId
      },
      include: menuInclude
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
    data: decorateMenu(menu)
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
  updateMenu,
  validateMenuPrice
};
