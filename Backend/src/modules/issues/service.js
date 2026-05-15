const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { assertSppgOwnership, requireSppgScope } = require("../../utils/ownership");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");

const prisma = getPrismaClient();

const buildIssueWhere = ({ query = {}, user }) => {
  const baseWhere = {
    deletedAt: null,
    sppg: {
      deletedAt: null
    },
    ...(query.category ? { category: query.category } : {}),
    ...(query.status ? { status: query.status } : {})
  };

  if (user.role === "sppg") {
    return {
      ...baseWhere,
      sppgId: requireSppgScope(user)
    };
  }

  return {
    ...baseWhere,
    ...(query.sppgId ? { sppgId: Number(query.sppgId) } : {})
  };
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

const getActiveIssueById = async (id) => {
  const issue = await prisma.issue.findFirst({
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

  if (!issue) {
    throw new AppError("Issue not found.", 404, "ISSUE_NOT_FOUND");
  }

  return issue;
};

const listIssues = async ({ query, user }) => {
  const pagination = parsePagination(query);
  const where = buildIssueWhere({ query, user });

  const [items, total] = await Promise.all([
    prisma.issue.findMany({
      where,
      include: {
        sppg: true,
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.issue.count({ where })
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

const createIssue = async ({ payload, user, ipAddress }) => {
  const targetSppgId = user.role === "sppg" ? requireSppgScope(user) : payload.sppgId;

  if (!targetSppgId) {
    throw new AppError("sppgId is required.", 400, "SPPG_ID_REQUIRED");
  }

  if (user.role === "sppg") {
    assertSppgOwnership(user, targetSppgId);
  }

  await getActiveSppg(targetSppgId);

  const issue = await prisma.$transaction(async (tx) => {
    const created = await tx.issue.create({
      data: {
        sppgId: targetSppgId,
        reportedBy: user.userId,
        category: payload.category,
        description: payload.description.trim()
      },
      include: {
        sppg: true
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "INSERT",
      tableName: "issues",
      recordId: created.id,
      newData: created,
      ipAddress
    });

    return created;
  });

  return {
    data: issue
  };
};

const updateIssueStatus = async ({ id, status, user, ipAddress }) => {
  const existing = await getActiveIssueById(id);

  const issue = await prisma.$transaction(async (tx) => {
    const updated = await tx.issue.update({
      where: {
        id: existing.id
      },
      data: {
        status
      },
      include: {
        sppg: true
      }
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "UPDATE",
      tableName: "issues",
      recordId: updated.id,
      oldData: existing,
      newData: updated,
      ipAddress
    });

    return updated;
  });

  return {
    data: issue
  };
};

module.exports = {
  createIssue,
  listIssues,
  updateIssueStatus
};
