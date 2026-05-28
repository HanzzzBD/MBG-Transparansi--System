const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");

const prisma = getPrismaClient();

const logPermissionConfigIssue = (message, details = {}) => {
  console.warn("[permission-config]", message, details);
};

const normalizePermissionRows = (rows) =>
  rows
    .map((row) => row.permission?.key)
    .filter(Boolean)
    .sort((first, second) => first.localeCompare(second));

const serializePermission = (permission) => ({
  id: permission.id,
  key: permission.key,
  name: permission.name,
  description: permission.description,
  group: permission.group,
  createdAt: permission.createdAt,
  updatedAt: permission.updatedAt
});

const groupPermissions = (permissions) => {
  const groups = new Map();

  for (const permission of permissions) {
    const group = permission.group || "other";
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group).push(serializePermission(permission));
  }

  return Array.from(groups.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([group, items]) => ({
      group,
      permissions: items.sort((first, second) => first.key.localeCompare(second.key))
    }));
};

const normalizeOverrideRows = (rows, effect) =>
  rows
    .filter((row) => row.effect === effect)
    .map((row) => ({
      id: row.id,
      permissionKey: row.permission?.key,
      permission: row.permission ? serializePermission(row.permission) : null,
      effect: row.effect,
      grantedBy: row.grantedBy,
      reason: row.reason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }))
    .filter((row) => row.permissionKey)
    .sort((first, second) => first.permissionKey.localeCompare(second.permissionKey));

const SENSITIVE_PERMISSION_PREFIX = "permission.";
const CRITICAL_ADMIN_PERMISSIONS = new Set([
  "permission.view",
  "permission.grant",
  "permission.revoke",
  "permission.manage_role_default"
]);

const isSensitivePermission = (permissionKey) => permissionKey.startsWith(SENSITIVE_PERMISSION_PREFIX);

const permissionExists = async (permissionKey, { client = prisma } = {}) => {
  if (!permissionKey || typeof permissionKey !== "string") {
    return false;
  }

  const permission = await client.permission.findUnique({
    where: {
      key: permissionKey
    },
    select: {
      id: true
    }
  });

  return Boolean(permission);
};

const getPermissionByKey = async (permissionKey, { client = prisma } = {}) => {
  if (!permissionKey || typeof permissionKey !== "string") {
    return null;
  }

  return client.permission.findUnique({
    where: {
      key: permissionKey
    }
  });
};

const getActiveUserById = async (userId, { client = prisma } = {}) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return null;
  }

  return client.user.findFirst({
    where: {
      id: normalizedUserId,
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
      isActive: true
    }
  });
};

const getRolePermissions = async (role, { client = prisma } = {}) => {
  if (!role) {
    return [];
  }

  const rows = await client.rolePermission.findMany({
    where: {
      role
    },
    select: {
      permission: {
        select: {
          key: true
        }
      }
    }
  });

  return normalizePermissionRows(rows);
};

const getUserPermissionOverrides = async (userId, { client = prisma } = {}) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return {
      allow: [],
      deny: []
    };
  }

  const rows = await client.userPermission.findMany({
    where: {
      userId: normalizedUserId
    },
    select: {
      effect: true,
      permission: {
        select: {
          key: true
        }
      }
    }
  });

  const allow = new Set();
  const deny = new Set();

  for (const row of rows) {
    const key = row.permission?.key;
    if (!key) continue;

    if (row.effect === "DENY") {
      deny.add(key);
      continue;
    }

    if (row.effect === "ALLOW") {
      allow.add(key);
    }
  }

  return {
    allow: Array.from(allow).sort((first, second) => first.localeCompare(second)),
    deny: Array.from(deny).sort((first, second) => first.localeCompare(second))
  };
};

const listPermissions = async ({ client = prisma } = {}) => {
  const permissions = await client.permission.findMany({
    orderBy: [{ group: "asc" }, { key: "asc" }]
  });

  return {
    permissions: permissions.map(serializePermission),
    groups: groupPermissions(permissions)
  };
};

const getEffectivePermissions = async (userId, { client = prisma } = {}) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return [];
  }

  const user = await client.user.findFirst({
    where: {
      id: normalizedUserId,
      isActive: true,
      deletedAt: null
    },
    select: {
      id: true,
      role: true
    }
  });

  if (!user) {
    return [];
  }

  const [rolePermissions, overrides] = await Promise.all([
    getRolePermissions(user.role, { client }),
    getUserPermissionOverrides(user.id, { client })
  ]);

  const effective = new Set(rolePermissions);
  for (const key of overrides.allow) {
    effective.add(key);
  }

  for (const key of overrides.deny) {
    effective.delete(key);
  }

  return Array.from(effective).sort((first, second) => first.localeCompare(second));
};

const getUserPermissionSummary = async (userId, { client = prisma } = {}) => {
  const user = await getActiveUserById(userId, { client });

  if (!user) {
    throw new AppError("User not found.", 404, "USER_NOT_FOUND");
  }

  const [rolePermissions, overrideRows, effectivePermissions] = await Promise.all([
    getRolePermissions(user.role, { client }),
    client.userPermission.findMany({
      where: {
        userId: user.id
      },
      include: {
        permission: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    }),
    getEffectivePermissions(user.id, { client })
  ]);

  return {
    user,
    rolePermissions,
    userAllowPermissions: normalizeOverrideRows(overrideRows, "ALLOW"),
    userDenyPermissions: normalizeOverrideRows(overrideRows, "DENY"),
    effectivePermissions
  };
};

const hasPermission = async (userId, permissionKey, { client = prisma } = {}) => {
  if (!(await permissionExists(permissionKey, { client }))) {
    logPermissionConfigIssue("Unknown permission key checked.", {
      permissionKey,
      userId
    });
    return false;
  }

  const effectivePermissions = await getEffectivePermissions(userId, { client });
  return effectivePermissions.includes(permissionKey);
};

const assertPermission = async (userId, permissionKey, { client = prisma } = {}) => {
  const allowed = await hasPermission(userId, permissionKey, { client });

  if (!allowed) {
    throw new AppError("You do not have permission to perform this action.", 403, "PERMISSION_DENIED", {
      permissionKey
    });
  }

  return true;
};

const assertKnownPermission = async (permissionKey, { client = prisma } = {}) => {
  const permission = await getPermissionByKey(permissionKey, { client });

  if (!permission) {
    logPermissionConfigIssue("Permission mutation requested for unknown key.", {
      permissionKey
    });
    throw new AppError("Permission was not found.", 404, "PERMISSION_NOT_FOUND", {
      permissionKey
    });
  }

  return permission;
};

const getSuperAdminUserId = async ({ client = prisma } = {}) => {
  const user = await client.user.findFirst({
    where: {
      role: "admin",
      isActive: true,
      deletedAt: null
    },
    orderBy: {
      id: "asc"
    },
    select: {
      id: true
    }
  });

  return user?.id || null;
};

const isSuperAdmin = async (actorUserId, { client = prisma } = {}) => {
  const superAdminUserId = await getSuperAdminUserId({ client });
  return Boolean(superAdminUserId && Number(actorUserId) === Number(superAdminUserId));
};

const assertActorCanMutatePermission = async ({ actorUserId, permissionKey, client = prisma }) => {
  const [actorHasTargetPermission, actorIsSuperAdmin] = await Promise.all([
    hasPermission(actorUserId, permissionKey, { client }),
    isSuperAdmin(actorUserId, { client })
  ]);

  if (!actorHasTargetPermission && !actorIsSuperAdmin) {
    throw new AppError("You cannot grant or revoke a permission you do not have.", 403, "PERMISSION_SCOPE_DENIED", {
      permissionKey
    });
  }

  if (isSensitivePermission(permissionKey)) {
    const hasManageRoleDefault = await hasPermission(actorUserId, "permission.manage_role_default", { client });
    if (!hasManageRoleDefault && !actorIsSuperAdmin) {
      throw new AppError("Managing permission grants requires elevated permission management access.", 403, "PERMISSION_SCOPE_DENIED", {
        permissionKey,
        requiredPermission: "permission.manage_role_default"
      });
    }
  }
};

const wouldKeepCriticalAccess = ({ permissionKey, targetUserId, actorUserId, nextEffectivePermissions }) => {
  if (Number(targetUserId) !== Number(actorUserId)) {
    return true;
  }

  if (!CRITICAL_ADMIN_PERMISSIONS.has(permissionKey)) {
    return true;
  }

  return nextEffectivePermissions.includes(permissionKey);
};

const assertNoSelfLockout = async ({ targetUserId, actorUserId, permissionKey, nextEffect, client = prisma }) => {
  if (Number(targetUserId) !== Number(actorUserId) || !CRITICAL_ADMIN_PERMISSIONS.has(permissionKey)) {
    return;
  }

  const user = await getActiveUserById(targetUserId, { client });
  if (!user) {
    throw new AppError("User not found.", 404, "USER_NOT_FOUND");
  }

  const [rolePermissions, overrides] = await Promise.all([
    getRolePermissions(user.role, { client }),
    getUserPermissionOverrides(user.id, { client })
  ]);
  const nextPermissions = new Set(rolePermissions);

  for (const key of overrides.allow) nextPermissions.add(key);
  for (const key of overrides.deny) nextPermissions.delete(key);

  if (nextEffect === "DENY") {
    nextPermissions.delete(permissionKey);
  } else if (nextEffect === "ALLOW") {
    nextPermissions.add(permissionKey);
  } else if (nextEffect === "RESET") {
    nextPermissions.delete(permissionKey);
    if (rolePermissions.includes(permissionKey)) {
      nextPermissions.add(permissionKey);
    }
  }

  if (!wouldKeepCriticalAccess({
    permissionKey,
    targetUserId,
    actorUserId,
    nextEffectivePermissions: Array.from(nextPermissions)
  })) {
    throw new AppError("This permission change would remove your own critical admin access.", 409, "ADMIN_PERMISSION_LOCKOUT_PREVENTED", {
      permissionKey
    });
  }
};

const findUserPermissionOverride = ({ userId, permissionId, client = prisma }) =>
  client.userPermission.findUnique({
    where: {
      userId_permissionId: {
        userId,
        permissionId
      }
    },
    include: {
      permission: true
    }
  });

const writePermissionAudit = async ({ client, actorUserId, action, recordId, oldData, newData, ipAddress }) => {
  await createAuditLog({
    prisma: client,
    userId: actorUserId,
    action,
    tableName: "user_permissions",
    recordId,
    oldData,
    newData,
    ipAddress
  });
};

const upsertUserPermission = async ({ targetUserId, permission, effect, actorUserId, reason, ipAddress, client }) => {
  const existing = await findUserPermissionOverride({
    userId: targetUserId,
    permissionId: permission.id,
    client
  });

  const saved = existing
    ? await client.userPermission.update({
        where: {
          id: existing.id
        },
        data: {
          effect,
          grantedBy: actorUserId,
          reason: reason || null
        },
        include: {
          permission: true
        }
      })
    : await client.userPermission.create({
        data: {
          userId: targetUserId,
          permissionId: permission.id,
          effect,
          grantedBy: actorUserId,
          reason: reason || null
        },
        include: {
          permission: true
        }
      });

  await writePermissionAudit({
    client,
    actorUserId,
    action: existing ? "UPDATE" : "INSERT",
    recordId: saved.id,
    oldData: existing,
    newData: saved,
    ipAddress
  });

  return saved;
};

const grantUserPermission = async ({ targetUserId, permissionKey, actorUserId, reason = null, ipAddress = null }) =>
  prisma.$transaction(async (tx) => {
    const permission = await assertKnownPermission(permissionKey, { client: tx });
    const targetUser = await getActiveUserById(targetUserId, { client: tx });
    if (!targetUser) {
      throw new AppError("User not found.", 404, "USER_NOT_FOUND");
    }

    await assertActorCanMutatePermission({ actorUserId, permissionKey, client: tx });
    await assertNoSelfLockout({
      targetUserId: targetUser.id,
      actorUserId,
      permissionKey,
      nextEffect: "ALLOW",
      client: tx
    });

    await upsertUserPermission({
      targetUserId: targetUser.id,
      permission,
      effect: "ALLOW",
      actorUserId,
      reason,
      ipAddress,
      client: tx
    });

    return getUserPermissionSummary(targetUser.id, { client: tx });
  });

const denyUserPermission = async ({ targetUserId, permissionKey, actorUserId, reason = null, ipAddress = null }) =>
  prisma.$transaction(async (tx) => {
    const permission = await assertKnownPermission(permissionKey, { client: tx });
    const targetUser = await getActiveUserById(targetUserId, { client: tx });
    if (!targetUser) {
      throw new AppError("User not found.", 404, "USER_NOT_FOUND");
    }

    await assertActorCanMutatePermission({ actorUserId, permissionKey, client: tx });
    await assertNoSelfLockout({
      targetUserId: targetUser.id,
      actorUserId,
      permissionKey,
      nextEffect: "DENY",
      client: tx
    });

    await upsertUserPermission({
      targetUserId: targetUser.id,
      permission,
      effect: "DENY",
      actorUserId,
      reason,
      ipAddress,
      client: tx
    });

    return getUserPermissionSummary(targetUser.id, { client: tx });
  });

const resetUserPermissionOverride = async ({ targetUserId, permissionKey, actorUserId, reason = null, ipAddress = null }) =>
  prisma.$transaction(async (tx) => {
    const permission = await assertKnownPermission(permissionKey, { client: tx });
    const targetUser = await getActiveUserById(targetUserId, { client: tx });
    if (!targetUser) {
      throw new AppError("User not found.", 404, "USER_NOT_FOUND");
    }

    await assertActorCanMutatePermission({ actorUserId, permissionKey, client: tx });
    await assertNoSelfLockout({
      targetUserId: targetUser.id,
      actorUserId,
      permissionKey,
      nextEffect: "RESET",
      client: tx
    });

    const existing = await findUserPermissionOverride({
      userId: targetUser.id,
      permissionId: permission.id,
      client: tx
    });

    if (existing) {
      await tx.userPermission.delete({
        where: {
          id: existing.id
        }
      });
    }

    await writePermissionAudit({
      client: tx,
      actorUserId,
      action: "DELETE",
      recordId: existing?.id || targetUser.id,
      oldData: existing,
      newData: {
        userId: targetUser.id,
        permissionKey,
        reason,
        resetToRoleDefault: true
      },
      ipAddress
    });

    return getUserPermissionSummary(targetUser.id, { client: tx });
  });

const revokeUserPermission = async ({ targetUserId, permissionKey, actorUserId, reason = null, ipAddress = null }) =>
  prisma.$transaction(async (tx) => {
    const permission = await assertKnownPermission(permissionKey, { client: tx });
    const targetUser = await getActiveUserById(targetUserId, { client: tx });
    if (!targetUser) {
      throw new AppError("User not found.", 404, "USER_NOT_FOUND");
    }

    await assertActorCanMutatePermission({ actorUserId, permissionKey, client: tx });

    const rolePermissions = await getRolePermissions(targetUser.role, { client: tx });
    const nextEffect = rolePermissions.includes(permissionKey) ? "DENY" : "RESET";

    await assertNoSelfLockout({
      targetUserId: targetUser.id,
      actorUserId,
      permissionKey,
      nextEffect,
      client: tx
    });

    if (nextEffect === "DENY") {
      await upsertUserPermission({
        targetUserId: targetUser.id,
        permission,
        effect: "DENY",
        actorUserId,
        reason,
        ipAddress,
        client: tx
      });
    } else {
      const existing = await findUserPermissionOverride({
        userId: targetUser.id,
        permissionId: permission.id,
        client: tx
      });

      if (existing) {
        await tx.userPermission.delete({
          where: {
            id: existing.id
          }
        });
      }

      await writePermissionAudit({
        client: tx,
        actorUserId,
        action: "DELETE",
        recordId: existing?.id || targetUser.id,
        oldData: existing,
        newData: {
          userId: targetUser.id,
          permissionKey,
          reason,
          revokedUserOverride: true
        },
        ipAddress
      });
    }

    return getUserPermissionSummary(targetUser.id, { client: tx });
  });

module.exports = {
  assertPermission,
  denyUserPermission,
  getEffectivePermissions,
  getRolePermissions,
  getUserPermissionSummary,
  getUserPermissionOverrides,
  grantUserPermission,
  hasPermission,
  listPermissions,
  resetUserPermissionOverride,
  revokeUserPermission
};
