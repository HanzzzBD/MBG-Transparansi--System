process.env.NODE_ENV = process.env.NODE_ENV || "test";

const assert = require("node:assert/strict");
const http = require("node:http");
const { after, before, describe, it } = require("node:test");

const express = require("express");

const { getPrismaClient } = require("../src/config/prisma");
const { errorHandler } = require("../src/middlewares/errorHandler");
const { authenticate } = require("../src/middlewares/auth");
const { requirePermission } = require("../src/middlewares/permissions");
const permissionService = require("../src/modules/permissions/service");
const { signAccessToken } = require("../src/utils/auth");

const prisma = getPrismaClient();

const state = {
  prefix: `permission_middleware_${Date.now()}`,
  server: null,
  baseUrl: "",
  users: {},
  permissions: {}
};

const permissionKey = (suffix) => `${state.prefix}.${suffix}`;

async function request(path, { token } = {}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${state.baseUrl}${path}`, {
    headers
  });
  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null
  };
}

function tokenFor(user) {
  return signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role
  });
}

async function createUser(name) {
  return prisma.user.create({
    data: {
      name: `${state.prefix} ${name}`,
      email: `${state.prefix}.${name}@example.test`,
      password: "not-used-in-middleware-test",
      role: "sppg",
      isActive: true
    }
  });
}

describe("requirePermission middleware", () => {
  before(async () => {
    state.permissions.view = await prisma.permission.create({
      data: {
        key: permissionKey("permission.view"),
        name: "Permission Middleware View",
        group: state.prefix
      }
    });
    state.permissions.grant = await prisma.permission.create({
      data: {
        key: permissionKey("permission.grant"),
        name: "Permission Middleware Grant",
        group: state.prefix
      }
    });

    state.users.allowed = await createUser("allowed");
    state.users.denied = await createUser("denied");

    await prisma.rolePermission.create({
      data: {
        role: "sppg",
        permissionId: state.permissions.view.id
      }
    });

    await prisma.userPermission.create({
      data: {
        userId: state.users.denied.id,
        permissionId: state.permissions.view.id,
        effect: "DENY",
        reason: "Middleware test deny override."
      }
    });

    const app = express();
    app.get(
      "/allowed",
      authenticate,
      requirePermission(permissionKey("permission.view")),
      (_req, res) => res.status(200).json({ ok: true })
    );
    app.get(
      "/not-granted",
      authenticate,
      requirePermission(permissionKey("permission.grant")),
      (_req, res) => res.status(200).json({ ok: true })
    );
    app.get(
      "/missing-permission",
      authenticate,
      requirePermission(permissionKey("missing")),
      (_req, res) => res.status(200).json({ ok: true })
    );
    app.get(
      "/unexpected-error",
      authenticate,
      requirePermission(permissionKey("permission.view")),
      (_req, res) => res.status(200).json({ ok: true })
    );
    app.use(errorHandler);

    state.server = http.createServer(app);
    await new Promise((resolve) => state.server.listen(0, "127.0.0.1", resolve));
    const address = state.server.address();
    state.baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (state.server) {
      await new Promise((resolve) => state.server.close(resolve));
    }

    await prisma.user.deleteMany({
      where: {
        email: {
          contains: state.prefix
        }
      }
    });
    await prisma.permission.deleteMany({
      where: {
        key: {
          startsWith: state.prefix
        }
      }
    });
    await prisma.$disconnect();
  });

  it("continues when the authenticated user has the effective permission", async () => {
    const response = await request("/allowed", {
      token: tokenFor(state.users.allowed)
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true });
  });

  it("returns 403 when the user lacks the required permission", async () => {
    const response = await request("/not-granted", {
      token: tokenFor(state.users.allowed)
    });

    assert.equal(response.status, 403);
    assert.equal(response.body.message, "Anda tidak memiliki akses untuk melakukan aksi ini.");
    assert.equal(response.body.code, "PERMISSION_DENIED");
  });

  it("lets user DENY override a role permission", async () => {
    const response = await request("/allowed", {
      token: tokenFor(state.users.denied)
    });

    assert.equal(response.status, 403);
    assert.equal(response.body.message, "Anda tidak memiliki akses untuk melakukan aksi ini.");
    assert.equal(response.body.code, "PERMISSION_DENIED");
  });

  it("does not crash for an unknown permission key", async () => {
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);

    try {
      const response = await request("/missing-permission", {
        token: tokenFor(state.users.allowed)
      });

      assert.equal(response.status, 403);
      assert.equal(response.body.message, "Anda tidak memiliki akses untuk melakukan aksi ini.");
      assert.equal(response.body.code, "PERMISSION_DENIED");
      assert.ok(warnings.some((warning) => String(warning[0]).includes("permission-config")));
    } finally {
      console.warn = originalWarn;
    }
  });

  it("logs unexpected permission failures neatly and returns controlled 403", async () => {
    const originalWarn = console.warn;
    const originalHasPermission = permissionService.hasPermission;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);
    permissionService.hasPermission = async () => {
      throw new Error("Simulated permission backend failure.");
    };

    try {
      const response = await request("/unexpected-error", {
        token: tokenFor(state.users.allowed)
      });

      assert.equal(response.status, 403);
      assert.equal(response.body.message, "Anda tidak memiliki akses untuk melakukan aksi ini.");
      assert.equal(response.body.code, "PERMISSION_DENIED");
      assert.ok(warnings.some((warning) => String(warning[0]).includes("permission-middleware")));
    } finally {
      permissionService.hasPermission = originalHasPermission;
      console.warn = originalWarn;
    }
  });

  it("returns 401 when authentication has not populated req.user", async () => {
    const response = await request("/allowed");

    assert.equal(response.status, 401);
  });
});
