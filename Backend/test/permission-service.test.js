process.env.NODE_ENV = process.env.NODE_ENV || "test";

const assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");

const { getPrismaClient } = require("../src/config/prisma");
const permissionService = require("../src/modules/permissions/service");
const AppError = require("../src/utils/appError");

const prisma = getPrismaClient();

const state = {
  prefix: `permission_service_${Date.now()}`,
  user: null,
  permissions: {}
};

const makeKey = (suffix) => `${state.prefix}.${suffix}`;

async function createPermission(suffix) {
  const key = makeKey(suffix);
  const permission = await prisma.permission.create({
    data: {
      key,
      name: `Test ${suffix}`,
      group: state.prefix,
      description: "Permission service test permission."
    }
  });

  state.permissions[suffix] = permission;
  return permission;
}

describe("permission resolution service", () => {
  before(async () => {
    const [rolePermission, userAllowPermission, deniedPermission] = await Promise.all([
      createPermission("distribution.create"),
      createPermission("distribution.mark_sent"),
      createPermission("daily_menu.update")
    ]);

    state.user = await prisma.user.create({
      data: {
        name: `${state.prefix} user`,
        email: `${state.prefix}@example.test`,
        password: "not-used-in-service-test",
        role: "sppg",
        isActive: true
      }
    });

    await prisma.rolePermission.createMany({
      data: [
        {
          role: "sppg",
          permissionId: rolePermission.id
        },
        {
          role: "sppg",
          permissionId: deniedPermission.id
        }
      ]
    });

    await prisma.userPermission.createMany({
      data: [
        {
          userId: state.user.id,
          permissionId: userAllowPermission.id,
          effect: "ALLOW",
          reason: "Test user-specific allow."
        },
        {
          userId: state.user.id,
          permissionId: deniedPermission.id,
          effect: "DENY",
          reason: "Test deny wins."
        }
      ],
      skipDuplicates: true
    });
  });

  after(async () => {
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

  it("loads role permissions by role", async () => {
    const permissions = await permissionService.getRolePermissions("sppg");

    assert.ok(permissions.includes(makeKey("distribution.create")));
    assert.ok(permissions.includes(makeKey("daily_menu.update")));
  });

  it("loads user permission overrides split by effect", async () => {
    const overrides = await permissionService.getUserPermissionOverrides(state.user.id);

    assert.ok(overrides.allow.includes(makeKey("distribution.mark_sent")));
    assert.ok(overrides.deny.includes(makeKey("daily_menu.update")));
  });

  it("calculates effective permissions with user ALLOW and DENY precedence", async () => {
    const effective = await permissionService.getEffectivePermissions(state.user.id);

    assert.ok(effective.includes(makeKey("distribution.create")));
    assert.ok(effective.includes(makeKey("distribution.mark_sent")));
    assert.equal(effective.includes(makeKey("daily_menu.update")), false);
  });

  it("keeps DENY winning even if a bad data source returns ALLOW and DENY for the same key", async () => {
    const fakeClient = {
      user: {
        findFirst: async () => ({
          id: 999999,
          role: "sppg"
        })
      },
      rolePermission: {
        findMany: async () => [
          {
            permission: {
              key: "distribution.create"
            }
          }
        ]
      },
      userPermission: {
        findMany: async () => [
          {
            effect: "ALLOW",
            permission: {
              key: "distribution.mark_sent"
            }
          },
          {
            effect: "ALLOW",
            permission: {
              key: "daily_menu.update"
            }
          },
          {
            effect: "DENY",
            permission: {
              key: "daily_menu.update"
            }
          }
        ]
      }
    };

    const effective = await permissionService.getEffectivePermissions(999999, { client: fakeClient });

    assert.deepEqual(effective, ["distribution.create", "distribution.mark_sent"]);
  });

  it("checks and asserts permissions without frontend bypass assumptions", async () => {
    assert.equal(await permissionService.hasPermission(state.user.id, makeKey("distribution.create")), true);
    assert.equal(await permissionService.hasPermission(state.user.id, makeKey("distribution.mark_sent")), true);
    assert.equal(await permissionService.hasPermission(state.user.id, makeKey("daily_menu.update")), false);

    await assert.doesNotReject(() =>
      permissionService.assertPermission(state.user.id, makeKey("distribution.mark_sent"))
    );

    await assert.rejects(
      () => permissionService.assertPermission(state.user.id, makeKey("daily_menu.update")),
      (error) => error instanceof AppError && error.statusCode === 403 && error.code === "PERMISSION_DENIED"
    );
  });

  it("handles unknown permissions safely", async () => {
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);

    try {
      assert.equal(await permissionService.hasPermission(state.user.id, makeKey("unknown.permission")), false);

      await assert.rejects(
        () => permissionService.assertPermission(state.user.id, makeKey("unknown.permission")),
        (error) => error instanceof AppError && error.statusCode === 403 && error.code === "PERMISSION_DENIED"
      );

      assert.equal(warnings.length, 2);
      assert.match(String(warnings[0][0]), /permission-config/);
    } finally {
      console.warn = originalWarn;
    }
  });
});
