process.env.NODE_ENV = process.env.NODE_ENV || "test";

const assert = require("node:assert/strict");
const http = require("node:http");
const { after, before, describe, it } = require("node:test");

const app = require("../src/app");
const { getPrismaClient } = require("../src/config/prisma");
const { signAccessToken } = require("../src/utils/auth");

const prisma = getPrismaClient();

const state = {
  prefix: `real_permission_guard_${Date.now()}`,
  server: null,
  baseUrl: "",
  sppg: null,
  school: null,
  menu: null,
  users: {},
  distributions: {},
  validations: {}
};

const requiredRolePermissions = {
  admin: ["admin.users.manage", "user.lock", "user.unlock", "audit.view"],
  sppg: ["distribution.view", "distribution.create", "distribution.correct", "distribution.mark_sent"],
  sekolah: ["distribution.view", "distribution.confirm", "distribution.report_issue", "issue.view"]
};

async function ensurePermission(key, roles = []) {
  const permission = await prisma.permission.upsert({
    where: {
      key
    },
    update: {},
    create: {
      key,
      name: key,
      group: key.split(".")[0]
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

async function denyPermission(user, permissionKey) {
  const permission = await ensurePermission(permissionKey);

  return prisma.userPermission.upsert({
    where: {
      userId_permissionId: {
        userId: user.id,
        permissionId: permission.id
      }
    },
    update: {
      effect: "DENY",
      reason: "Real flow permission guard test."
    },
    create: {
      userId: user.id,
      permissionId: permission.id,
      effect: "DENY",
      reason: "Real flow permission guard test."
    }
  });
}

function tokenFor(user) {
  return signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role
  });
}

async function request(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${state.baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);

  return {
    status: response.status,
    body: payload
  };
}

async function createUser(role, label, extra = {}) {
  return prisma.user.create({
    data: {
      name: `${state.prefix} ${label}`,
      email: `${state.prefix}.${label}@example.test`,
      password: "not-used-in-real-flow-permission-test",
      role,
      isActive: true,
      ...extra
    }
  });
}

async function createDistribution(label) {
  const distribution = await prisma.distribution.create({
    data: {
      sppgId: state.sppg.id,
      schoolId: state.school.id,
      menuId: state.menu.id,
      portions: 25,
      pricePerPortion: 12000,
      distributionDate: new Date("2026-05-28"),
      status: "in_progress"
    }
  });

  const validation = await prisma.validation.create({
    data: {
      distributionId: distribution.id,
      schoolId: state.school.id,
      receivedPortions: 0,
      status: "pending"
    }
  });

  state.distributions[label] = distribution;
  state.validations[label] = validation;

  return {
    distribution,
    validation
  };
}

describe("real backend flows are protected by permissions", () => {
  before(async () => {
    for (const [role, keys] of Object.entries(requiredRolePermissions)) {
      for (const key of keys) {
        await ensurePermission(key, [role]);
      }
    }

    state.sppg = await prisma.sppg.create({
      data: {
        name: `${state.prefix} SPPG`,
        province: `${state.prefix} Province`,
        city: `${state.prefix} City`,
        capacity: 500,
        status: "active"
      }
    });
    state.school = await prisma.school.create({
      data: {
        name: `${state.prefix} School`,
        province: state.sppg.province,
        city: state.sppg.city,
        sppgId: state.sppg.id,
        totalStudents: 200,
        npsn: `${state.prefix}_npsn`
      }
    });
    await prisma.sppgSchoolAssignment.create({
      data: {
        sppgId: state.sppg.id,
        schoolId: state.school.id,
        status: "active"
      }
    });
    state.menu = await prisma.menu.create({
      data: {
        sppgId: state.sppg.id,
        menuDate: new Date("2026-05-28"),
        menuName: `${state.prefix} Verified Menu`,
        items: ["Nasi", "Ayam", "Sayur"],
        manualPricePerPortion: "12000.00",
        priceValidationStatus: "VERIFIED",
        priceValidatedAt: new Date()
      }
    });

    state.users.operator = await createUser("sppg", "operator", {
      sppgId: state.sppg.id
    });
    state.users.supervisor = await createUser("sppg", "supervisor", {
      sppgId: state.sppg.id
    });
    state.users.schoolDenied = await createUser("sekolah", "school-denied", {
      schoolId: state.school.id
    });
    state.users.schoolAllowed = await createUser("sekolah", "school-allowed", {
      schoolId: state.school.id
    });
    state.users.adminDenied = await createUser("admin", "admin-denied");
    state.users.target = await createUser("sppg", "target-user", {
      sppgId: state.sppg.id
    });

    await Promise.all([
      denyPermission(state.users.operator, "distribution.mark_sent"),
      denyPermission(state.users.schoolDenied, "distribution.confirm"),
      denyPermission(state.users.schoolDenied, "distribution.report_issue"),
      denyPermission(state.users.adminDenied, "user.lock")
    ]);

    await createDistribution("markSent");
    await createDistribution("confirm");
    await createDistribution("reportIssue");

    state.server = http.createServer(app);
    await new Promise((resolve) => state.server.listen(0, "127.0.0.1", resolve));
    state.baseUrl = `http://127.0.0.1:${state.server.address().port}`;
  });

  after(async () => {
    if (state.server) {
      await new Promise((resolve) => state.server.close(resolve));
    }

    const userIds = Object.values(state.users).map((user) => user?.id).filter(Boolean);
    const distributionIds = Object.values(state.distributions).map((distribution) => distribution?.id).filter(Boolean);

    await prisma.schoolReport.deleteMany({
      where: {
        OR: [
          {
            distributionId: {
              in: distributionIds.length ? distributionIds : [-1]
            }
          },
          {
            reportedBy: {
              in: userIds.length ? userIds : [-1]
            }
          }
        ]
      }
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          {
            userId: {
              in: userIds.length ? userIds : [-1]
            }
          },
          {
            tableName: {
              in: ["distributions", "validations", "school_reports", "users"]
            },
            recordId: {
              in: distributionIds.length ? distributionIds : [-1]
            }
          }
        ]
      }
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: userIds.length ? userIds : [-1]
        }
      }
    });
    await prisma.validation.deleteMany({
      where: {
        distributionId: {
          in: distributionIds.length ? distributionIds : [-1]
        }
      }
    });
    await prisma.distribution.deleteMany({
      where: {
        id: {
          in: distributionIds.length ? distributionIds : [-1]
        }
      }
    });
    await prisma.menu.deleteMany({
      where: {
        id: state.menu?.id || -1
      }
    });
    await prisma.sppgSchoolAssignment.deleteMany({
      where: {
        sppgId: state.sppg?.id || -1
      }
    });
    await prisma.school.deleteMany({
      where: {
        id: state.school?.id || -1
      }
    });
    await prisma.sppg.deleteMany({
      where: {
        id: state.sppg?.id || -1
      }
    });
    await prisma.$disconnect();
  });

  it("blocks SPPG operator from marking a distribution as sent", async () => {
    const response = await request(`/api/distributions/${state.distributions.markSent.id}`, {
      method: "PUT",
      token: tokenFor(state.users.operator),
      body: {
        status: "delivered"
      }
    });

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "PERMISSION_DENIED");
  });

  it("allows SPPG supervisor to mark a distribution as sent", async () => {
    const response = await request(`/api/distributions/${state.distributions.markSent.id}`, {
      method: "PUT",
      token: tokenFor(state.users.supervisor),
      body: {
        status: "delivered"
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "delivered");
  });

  it("blocks school confirmation without distribution.confirm", async () => {
    const response = await request(`/api/validations/${state.validations.confirm.id}`, {
      method: "PUT",
      token: tokenFor(state.users.schoolDenied),
      body: {
        receivedPortions: 25,
        qualityOk: true,
        status: "verified"
      }
    });

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "PERMISSION_DENIED");
  });

  it("allows school confirmation with distribution.confirm", async () => {
    const response = await request(`/api/validations/${state.validations.confirm.id}`, {
      method: "PUT",
      token: tokenFor(state.users.schoolAllowed),
      body: {
        receivedPortions: 25,
        qualityOk: true,
        status: "verified"
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "verified");
  });

  it("blocks school issue reports without distribution.report_issue", async () => {
    const response = await request("/api/school-reports", {
      method: "POST",
      token: tokenFor(state.users.schoolDenied),
      body: {
        distributionId: state.distributions.reportIssue.id,
        validationId: state.validations.reportIssue.id,
        category: "keterlambatan",
        message: "Distribusi terlambat dari jadwal."
      }
    });

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "PERMISSION_DENIED");
  });

  it("allows school issue reports with distribution.report_issue", async () => {
    const response = await request("/api/school-reports", {
      method: "POST",
      token: tokenFor(state.users.schoolAllowed),
      body: {
        distributionId: state.distributions.reportIssue.id,
        validationId: state.validations.reportIssue.id,
        category: "keterlambatan",
        message: "Distribusi terlambat dari jadwal."
      }
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.distributionId, state.distributions.reportIssue.id);
  });

  it("blocks admin user lock without user.lock permission", async () => {
    const response = await request(`/api/admin/users/${state.users.target.id}/status`, {
      method: "PATCH",
      token: tokenFor(state.users.adminDenied),
      body: {
        isActive: false
      }
    });

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "PERMISSION_DENIED");
  });
});
