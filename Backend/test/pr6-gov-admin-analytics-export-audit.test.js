process.env.NODE_ENV = process.env.NODE_ENV || "test";

const assert = require("node:assert/strict");
const http = require("node:http");
const { after, before, describe, it } = require("node:test");

const app = require("../src/app");
const { getPrismaClient } = require("../src/config/prisma");
const { getRedisClient } = require("../src/config/redis");
const { signAccessToken } = require("../src/utils/auth");
const { shutdownExportRuntime } = require("../src/modules/exports/runtime");

const prisma = getPrismaClient();

const state = {
  prefix: `pr6_${Date.now()}`,
  server: null,
  baseUrl: "",
  sppg: {},
  schools: {},
  users: {},
  distributions: {},
  exports: [],
  files: [],
  tokens: {}
};

async function request(path, { method = "GET", token, body, raw = false } = {}) {
  const headers = {};

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${state.baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (raw) {
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") || "",
      status: response.status
    };
  }

  const payload = await response.json().catch(() => null);
  return {
    body: payload,
    headers: response.headers,
    status: response.status
  };
}

function tokenFor(user) {
  return signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role
  });
}

async function waitForExportDone(exportId) {
  const deadline = Date.now() + 10000;
  let latest;

  while (Date.now() < deadline) {
    latest = await prisma.export.findUnique({
      where: {
        id: exportId
      },
      include: {
        file: true
      }
    });

    if (latest?.status === "done") return latest;
    if (latest?.status === "failed") {
      throw new Error(latest.errorMsg || "Export failed.");
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`Export ${exportId} did not finish in time.`);
}

async function findAudit({ action, tableName, recordId }) {
  return prisma.auditLog.findFirst({
    where: {
      action,
      tableName,
      recordId
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

async function setupData() {
  const prefix = state.prefix;

  state.sppg.base = await prisma.sppg.create({
    data: {
      name: `${prefix} Base SPPG`,
      province: `${prefix} Province`,
      city: `${prefix} City`,
      capacity: 1000,
      status: "active"
    }
  });

  state.schools.base = await prisma.school.create({
    data: {
      name: `${prefix} Base School`,
      province: state.sppg.base.province,
      city: state.sppg.base.city,
      sppgId: state.sppg.base.id,
      totalStudents: 300,
      npsn: `${prefix}_base`
    }
  });

  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: `${prefix} Admin`,
        email: `${prefix}.admin@example.test`,
        password: "hashed",
        role: "admin"
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} Gov`,
        email: `${prefix}.gov@example.test`,
        password: "hashed",
        role: "pemerintah"
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} SPPG`,
        email: `${prefix}.sppg@example.test`,
        password: "hashed",
        role: "sppg",
        sppgId: state.sppg.base.id
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} School`,
        email: `${prefix}.school@example.test`,
        password: "hashed",
        role: "sekolah",
        schoolId: state.schools.base.id
      }
    })
  ]);

  [state.users.admin, state.users.gov, state.users.sppg, state.users.school] = users;
  state.tokens = {
    admin: tokenFor(state.users.admin),
    gov: tokenFor(state.users.gov),
    sppg: tokenFor(state.users.sppg),
    school: tokenFor(state.users.school)
  };

  state.distributions.base = await prisma.distribution.create({
    data: {
      sppgId: state.sppg.base.id,
      schoolId: state.schools.base.id,
      portions: 100,
      pricePerPortion: "12000.00",
      distributionDate: new Date("2026-05-26T00:00:00.000Z"),
      status: "in_progress",
      isLocked: false
    }
  });
}

async function cleanupData() {
  const userIds = Object.values(state.users).map((item) => item?.id).filter(Boolean);
  const sppgIds = Object.values(state.sppg).map((item) => item?.id).filter(Boolean);
  const schoolIds = Object.values(state.schools).map((item) => item?.id).filter(Boolean);
  const distributionIds = Object.values(state.distributions).map((item) => item?.id).filter(Boolean);

  const exports = await prisma.export.findMany({
    where: {
      OR: [
        { userId: { in: userIds.length ? userIds : [-1] } },
        { id: { in: state.exports.length ? state.exports : [-1] } }
      ]
    },
    select: {
      id: true,
      fileId: true
    }
  });
  const fileIds = exports.map((item) => item.fileId).filter(Boolean);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds.length ? userIds : [-1] } },
        { tableName: "sppg", recordId: { in: sppgIds.length ? sppgIds : [-1] } },
        { tableName: "schools", recordId: { in: schoolIds.length ? schoolIds : [-1] } },
        { tableName: "distributions", recordId: { in: distributionIds.length ? distributionIds : [-1] } },
        { tableName: "exports", recordId: { in: exports.map((item) => item.id).length ? exports.map((item) => item.id) : [-1] } },
        { tableName: "files", recordId: { in: fileIds.length ? fileIds : [-1] } }
      ]
    }
  });
  await prisma.export.deleteMany({
    where: {
      id: {
        in: exports.map((item) => item.id).length ? exports.map((item) => item.id) : [-1]
      }
    }
  });
  await prisma.file.deleteMany({
    where: {
      id: {
        in: fileIds.length ? fileIds : [-1]
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
  await prisma.userSession.deleteMany({
    where: {
      userId: {
        in: userIds.length ? userIds : [-1]
      }
    }
  });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: userIds.length ? userIds : [-1]
      }
    }
  });
  await prisma.school.deleteMany({
    where: {
      id: {
        in: schoolIds.length ? schoolIds : [-1]
      }
    }
  });
  await prisma.sppg.deleteMany({
    where: {
      id: {
        in: sppgIds.length ? sppgIds : [-1]
      }
    }
  });
}

describe("PR 6 gov/admin analytics export audit", () => {
  before(async () => {
    await setupData();
    state.server = http.createServer(app);
    await new Promise((resolve) => {
      state.server.listen(0, "127.0.0.1", resolve);
    });
    state.baseUrl = `http://127.0.0.1:${state.server.address().port}`;
  });

  after(async () => {
    await cleanupData();

    if (state.server) {
      await new Promise((resolve, reject) => {
        state.server.close((error) => (error ? reject(error) : resolve()));
      });
    }

    await shutdownExportRuntime();
    const redisClient = getRedisClient();
    if (redisClient) {
      await redisClient.quit().catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("enforces master data and restore permissions", async () => {
    const payload = {
      name: `${state.prefix} Permission SPPG`,
      province: `${state.prefix} Province`,
      city: `${state.prefix} City`,
      capacity: 400
    };

    const createdSppgResponse = await request("/api/sppg", { method: "POST", token: state.tokens.admin, body: payload });
    assert.equal(createdSppgResponse.status, 201);
    state.sppg.permission = createdSppgResponse.body.data;
    assert.equal((await request("/api/sppg", { method: "POST", token: state.tokens.gov, body: payload })).status, 403);
    assert.equal((await request("/api/sppg", { method: "POST", token: state.tokens.sppg, body: payload })).status, 403);
    assert.equal((await request("/api/sppg/deleted", { token: state.tokens.gov })).status, 403);

    const schoolPayload = {
      name: `${state.prefix} Permission School`,
      province: state.sppg.base.province,
      city: state.sppg.base.city,
      sppgId: state.sppg.base.id,
      totalStudents: 99
    };

    const createdSchoolResponse = await request("/api/schools", { method: "POST", token: state.tokens.admin, body: schoolPayload });
    assert.equal(createdSchoolResponse.status, 201);
    state.schools.permission = createdSchoolResponse.body.data;
    assert.equal((await request("/api/schools", { method: "POST", token: state.tokens.gov, body: schoolPayload })).status, 403);
    assert.equal((await request("/api/schools", { token: state.tokens.gov })).status, 200);
    assert.equal((await request("/api/schools", { token: state.tokens.sppg })).status, 403);
    assert.equal((await request("/api/audit-logs", { method: "DELETE", token: state.tokens.admin })).status, 404);
  });

  it("records audit old_data and new_data for SPPG create/update/delete/restore", async () => {
    const createResponse = await request("/api/sppg", {
      method: "POST",
      token: state.tokens.admin,
      body: {
        name: `${state.prefix} Audit SPPG`,
        province: `${state.prefix} Province`,
        city: `${state.prefix} City`,
        address: "Audit address",
        capacity: 700,
        workers: 12
      }
    });

    assert.equal(createResponse.status, 201);
    const sppg = createResponse.body.data;
    state.sppg.audit = sppg;

    const insertLog = await findAudit({ action: "INSERT", tableName: "sppg", recordId: sppg.id });
    assert.equal(insertLog.userId, state.users.admin.id);
    assert.equal(insertLog.oldData, null);
    assert.equal(insertLog.newData.name, sppg.name);

    const updateResponse = await request(`/api/sppg/${sppg.id}`, {
      method: "PUT",
      token: state.tokens.admin,
      body: {
        city: `${state.prefix} Updated City`
      }
    });

    assert.equal(updateResponse.status, 200);
    const updateLog = await findAudit({ action: "UPDATE", tableName: "sppg", recordId: sppg.id });
    assert.equal(updateLog.oldData.city, sppg.city);
    assert.equal(updateLog.newData.city, `${state.prefix} Updated City`);

    const deleteResponse = await request(`/api/sppg/${sppg.id}`, {
      method: "DELETE",
      token: state.tokens.admin
    });

    assert.equal(deleteResponse.status, 200);
    const deleteLog = await findAudit({ action: "DELETE", tableName: "sppg", recordId: sppg.id });
    assert.equal(deleteLog.oldData.deletedAt, null);
    assert.ok(deleteLog.newData.deletedAt);

    assert.equal((await request(`/api/sppg/${sppg.id}/restore`, { method: "PATCH", token: state.tokens.gov })).status, 403);
    const restoreResponse = await request(`/api/sppg/${sppg.id}/restore`, {
      method: "PATCH",
      token: state.tokens.admin
    });

    assert.equal(restoreResponse.status, 200);
    const restoreLog = await findAudit({ action: "UPDATE", tableName: "sppg", recordId: sppg.id });
    assert.ok(restoreLog.oldData.deletedAt);
    assert.equal(restoreLog.newData.deletedAt, null);
    assert.equal(restoreLog.newData.auditAction, "RESTORE");
  });

  it("records audit old_data and new_data for distribution lock/unlock", async () => {
    const lockResponse = await request(`/api/admin/distributions/${state.distributions.base.id}/lock`, {
      method: "POST",
      token: state.tokens.admin,
      body: {
        reason: "PR 6 lock audit test"
      }
    });

    assert.equal(lockResponse.status, 200);
    const lockLog = await findAudit({
      action: "LOCK",
      tableName: "distributions",
      recordId: state.distributions.base.id
    });
    assert.equal(lockLog.userId, state.users.admin.id);
    assert.equal(lockLog.oldData.isLocked, false);
    assert.equal(lockLog.newData.isLocked, true);

    const unlockResponse = await request(`/api/admin/distributions/${state.distributions.base.id}/unlock`, {
      method: "POST",
      token: state.tokens.admin,
      body: {
        reason: "PR 6 unlock audit test",
        autoRelockAfterOneHour: false
      }
    });

    assert.equal(unlockResponse.status, 200);
    const unlockLog = await findAudit({
      action: "UNLOCK",
      tableName: "distributions",
      recordId: state.distributions.base.id
    });
    assert.equal(unlockLog.userId, state.users.admin.id);
    assert.equal(unlockLog.oldData.isLocked, true);
    assert.equal(unlockLog.newData.isLocked, false);
  });

  it("creates and downloads PDF/XLSX exports for admin and pemerintah only", async () => {
    for (const type of ["pdf", "excel"]) {
      const createResponse = await request("/api/exports", {
        method: "POST",
        token: type === "pdf" ? state.tokens.gov : state.tokens.admin,
        body: {
          type,
          filterParams: {
            datasets: ["distributions"],
            date: "2026-05-26"
          }
        }
      });

      assert.equal(createResponse.status, 201);
      state.exports.push(createResponse.body.data.id);

      const done = await waitForExportDone(createResponse.body.data.id);
      assert.equal(done.status, "done");
      assert.ok(done.fileId);
      state.files.push(done.fileId);

      const download = await request(`/api/exports/${done.id}/download`, {
        token: type === "pdf" ? state.tokens.gov : state.tokens.admin,
        raw: true
      });

      assert.equal(download.status, 200);
      assert.ok(download.buffer.length > 0);
      if (type === "pdf") {
        assert.equal(download.buffer.subarray(0, 4).toString(), "%PDF");
        assert.match(download.contentType, /application\/pdf/);
      } else {
        assert.equal(download.buffer.subarray(0, 2).toString("hex"), "504b");
        assert.match(download.contentType, /spreadsheetml/);
      }
    }

    assert.equal((await request("/api/exports", { token: state.tokens.sppg })).status, 403);
    assert.equal((await request("/api/exports", { token: state.tokens.school })).status, 403);
  });
});
