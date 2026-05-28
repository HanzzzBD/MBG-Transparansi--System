const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { assertSppgOwnership, requireSppgScope } = require("../../utils/ownership");
const { buildPaginationMeta, parsePagination } = require("../../utils/pagination");

const prisma = getPrismaClient();
const CRITICAL_ISSUE_CATEGORIES = new Set(["kekurangan_bahan", "peralatan", "logistik"]);

const isCriticalIssueCategory = (category) => CRITICAL_ISSUE_CATEGORIES.has(category);

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
    }
  });

  if (!sppg) {
    throw new AppError("SPPG not found.", 404, "SPPG_NOT_FOUND");
  }

  return sppg;
};

const hasOpenCriticalIssue = async ({ tx, sppgId, excludeIssueId }) => {
  const count = await tx.issue.count({
    where: {
      sppgId: Number(sppgId),
      deletedAt: null,
      status: {
        in: ["open", "in_progress"]
      },
      category: {
        in: Array.from(CRITICAL_ISSUE_CATEGORIES)
      },
      ...(excludeIssueId ? { id: { not: Number(excludeIssueId) } } : {})
    }
  });

  return count > 0;
};

const markSppgProblemForCriticalIssue = async ({ tx, sppg, issue, userId, ipAddress }) => {
  if (!isCriticalIssueCategory(issue.category)) {
    return sppg;
  }

  if (sppg.status === "problem") {
    return sppg;
  }

  const updated = await tx.sppg.update({
    where: {
      id: sppg.id
    },
    data: {
      status: "problem"
    }
  });

  await createAuditLog({
    prisma: tx,
    userId,
    action: "UPDATE",
    tableName: "sppg",
    recordId: updated.id,
    oldData: sppg,
    newData: updated,
    ipAddress
  });

  return updated;
};

const restoreSppgAfterResolvedCriticalIssue = async ({ tx, issue, userId, ipAddress }) => {
  if (issue.status !== "resolved" || !isCriticalIssueCategory(issue.category) || issue.sppg?.status !== "problem") {
    return issue.sppg;
  }

  const stillHasOpenCriticalIssue = await hasOpenCriticalIssue({
    tx,
    sppgId: issue.sppgId,
    excludeIssueId: issue.id
  });

  if (stillHasOpenCriticalIssue) {
    return issue.sppg;
  }

  const updatedSppg = await tx.sppg.update({
    where: {
      id: issue.sppgId
    },
    data: {
      status: "active"
    }
  });

  await createAuditLog({
    prisma: tx,
    userId,
    action: "UPDATE",
    tableName: "sppg",
    recordId: updatedSppg.id,
    oldData: issue.sppg,
    newData: updatedSppg,
    ipAddress
  });

  return updatedSppg;
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

  const targetSppg = await getActiveSppg(targetSppgId);

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

    const updatedSppg = await markSppgProblemForCriticalIssue({
      tx,
      sppg: targetSppg,
      issue: created,
      userId: user.userId,
      ipAddress
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

    return {
      ...created,
      sppg: updatedSppg
    };
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

    const updatedSppg = await restoreSppgAfterResolvedCriticalIssue({
      tx,
      issue: updated,
      userId: user.userId,
      ipAddress
    });

    return {
      ...updated,
      sppg: updatedSppg || updated.sppg
    };
  });

  return {
    data: issue
  };
};

module.exports = {
  createIssue,
  isCriticalIssueCategory,
  listIssues,
  updateIssueStatus
};
