process.env.NODE_ENV = process.env.NODE_ENV || "test";

const assert = require("node:assert/strict");
const http = require("node:http");
const { after, before, describe, it } = require("node:test");

const app = require("../src/app");
const { getPrismaClient } = require("../src/config/prisma");
const { signAccessToken } = require("../src/utils/auth");

const prisma = getPrismaClient();

const state = {
  prefix: `permission_endpoint_${Date.now()}`,
  server: null,
  baseUrl: "",
  users: {},
  permissions: {}
};

const permissionKey = (suffix) => `${state.prefix}.${suffix}`;

const managementPermissionKeys = [
  "permission.view",
  "permission.grant",
  "permission.revoke",
  "permission.manage_role_default"
];

const tokenFor = (user) =>
  signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

async function request(method, path, { token, body } = {}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${state.baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null
  };
}

async function createUser(role, label) {
  return prisma.user.create({
    data: {
      name: `${state.prefix} ${label}`,
      email: `${state.prefix}.${label}@example.test`,
      password: "not-used-in-permission-endpoint-test",
      role,
      isActive: true
    }
  });
}

async function ensurePermission(key, roles = []) {
  const permission = await prisma.permission.upsert({
    where: {
      key
    },
    update: {
      group: key.startsWith(state.prefix) ? state.prefix : "permission"
    },
    create: {
      key,
      name: key,
      group: key.startsWith(state.prefix) ? state.prefix : "permission"
    }
  });

  if (roles.length > 0) {
    await prisma.rolePermission.createMany({
      data: roles.map((role) => ({
        role,
        permissionId: permission.id
      })),
      skipDuplicates: true
    });
  }

  return permission;
}

const keysFromOverrides = (rows) => rows.map((row) => row.permissionKey);

describe("admin permission management endpoints", () => {
  before(async () => {
    for (const key of managementPermissionKeys) {
      await ensurePermission(key, ["admin"]);
    }

    state.permissions.grantable = await ensurePermission(permissionKey("grantable"), ["admin"]);
    state.permissions.roleDefault = await ensurePermission(permissionKey("role_default"), ["admin", "sppg"]);
    state.permissions.allowOnly = await ensurePermission(permissionKey("allow_only"), ["admin"]);
    state.permissions.notOwned = await ensurePermission(permissionKey("not_owned"));

    state.users.superAdmin =
      (await prisma.user.findFirst({
        where: {
          role: "admin",
          isActive: true,
          deletedAt: null
        },
        orderBy: {
          id: "asc"
        }
      })) || (await createUser("admin", "super-admin"));
    state.users.actor = await createUser("admin", "actor");
    state.users.target = await createUser("sppg", "target");

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    state.server = server;
    state.baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (state.server) {
      await new Promise((resolve) => state.server.close(resolve));
    }

    const createdUsers = await prisma.user.findMany({
      where: {
        email: {
          contains: state.prefix
        }
      },
      select: {
        id: true
      }
    });
    const createdUserIds = createdUsers.map((user) => user.id);

    if (createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          userId: {
            in: createdUserIds
          }
        }
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: createdUserIds
          }
        }
      });
    }

    await prisma.permission.deleteMany({
      where: {
        key: {
          startsWith: state.prefix
        }
      }
    });
    await prisma.$disconnect();
  });

  it("lists permissions grouped by group", async () => {
    const response = await request("GET", "/api/permissions", {
      token: tokenFor(state.users.actor)
    });

    assert.equal(response.status, 200);
    assert.ok(response.body.data.permissions.some((permission) => permission.key === permissionKey("grantable")));
    assert.ok(response.body.data.groups.some((group) => group.group === state.prefix));
  });

  it("returns the current user's effective permissions", async () => {
    const response = await request("GET", "/api/me/permissions", {
      token: tokenFor(state.users.target)
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.id, state.users.target.id);
    assert.equal(response.body.data.role, "sppg");
    assert.ok(response.body.data.effectivePermissions.includes(permissionKey("role_default")));
  });

  it("returns one user's role, override, and effective permissions", async () => {
    const response = await request("GET", `/api/users/${state.users.target.id}/permissions`, {
      token: tokenFor(state.users.actor)
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.id, state.users.target.id);
    assert.ok(response.body.data.rolePermissions.includes(permissionKey("role_default")));
    assert.ok(response.body.data.effectivePermissions.includes(permissionKey("role_default")));
  });

  it("grants a user permission and writes an audit log", async () => {
    const response = await request("POST", `/api/users/${state.users.target.id}/permissions/grant`, {
      token: tokenFor(state.users.actor),
      body: {
        permissionKey: permissionKey("grantable"),
        reason: "Endpoint test grant."
      }
    });

    assert.equal(response.status, 200);
    assert.ok(keysFromOverrides(response.body.data.userAllowPermissions).includes(permissionKey("grantable")));
    assert.ok(response.body.data.effectivePermissions.includes(permissionKey("grantable")));

    const auditCount = await prisma.auditLog.count({
      where: {
        userId: state.users.actor.id,
        tableName: "user_permissions"
      }
    });
    assert.ok(auditCount >= 1);
  });

  it("denies a role default permission", async () => {
    const response = await request("POST", `/api/users/${state.users.target.id}/permissions/deny`, {
      token: tokenFor(state.users.actor),
      body: {
        permissionKey: permissionKey("role_default"),
        reason: "Endpoint test deny."
      }
    });

    assert.equal(response.status, 200);
    assert.ok(keysFromOverrides(response.body.data.userDenyPermissions).includes(permissionKey("role_default")));
    assert.ok(!response.body.data.effectivePermissions.includes(permissionKey("role_default")));
  });

  it("resets an override back to the role default", async () => {
    const response = await request(
      "DELETE",
      `/api/users/${state.users.target.id}/permissions/${permissionKey("role_default")}`,
      {
        token: tokenFor(state.users.actor)
      }
    );

    assert.equal(response.status, 200);
    assert.ok(!keysFromOverrides(response.body.data.userDenyPermissions).includes(permissionKey("role_default")));
    assert.ok(response.body.data.effectivePermissions.includes(permissionKey("role_default")));
  });

  it("revokes a user ALLOW override by removing it", async () => {
    await request("POST", `/api/users/${state.users.target.id}/permissions/grant`, {
      token: tokenFor(state.users.actor),
      body: {
        permissionKey: permissionKey("allow_only"),
        reason: "Prepare allow-only revoke."
      }
    });

    const response = await request("POST", `/api/users/${state.users.target.id}/permissions/revoke`, {
      token: tokenFor(state.users.actor),
      body: {
        permissionKey: permissionKey("allow_only"),
        reason: "Endpoint test revoke allow."
      }
    });

    assert.equal(response.status, 200);
    assert.ok(!keysFromOverrides(response.body.data.userAllowPermissions).includes(permissionKey("allow_only")));
    assert.ok(!response.body.data.effectivePermissions.includes(permissionKey("allow_only")));
  });

  it("revokes a role default permission by creating a DENY override", async () => {
    const response = await request("POST", `/api/users/${state.users.target.id}/permissions/revoke`, {
      token: tokenFor(state.users.actor),
      body: {
        permissionKey: permissionKey("role_default"),
        reason: "Endpoint test revoke role default."
      }
    });

    assert.equal(response.status, 200);
    assert.ok(keysFromOverrides(response.body.data.userDenyPermissions).includes(permissionKey("role_default")));
    assert.ok(!response.body.data.effectivePermissions.includes(permissionKey("role_default")));
  });

  it("blocks an admin from granting a permission they do not have", async () => {
    const response = await request("POST", `/api/users/${state.users.target.id}/permissions/grant`, {
      token: tokenFor(state.users.actor),
      body: {
        permissionKey: permissionKey("not_owned"),
        reason: "Should be blocked."
      }
    });

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "PERMISSION_SCOPE_DENIED");
  });
});
