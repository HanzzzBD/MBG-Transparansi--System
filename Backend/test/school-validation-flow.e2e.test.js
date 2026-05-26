process.env.NODE_ENV = process.env.NODE_ENV || "test";

const assert = require("node:assert/strict");
const http = require("node:http");
const { after, before, describe, it } = require("node:test");

const app = require("../src/app");
const { getPrismaClient } = require("../src/config/prisma");
const { getRedisClient } = require("../src/config/redis");
const { signAccessToken } = require("../src/utils/auth");

const prisma = getPrismaClient();

const state = {
  prefix: `E2E_SCHOOL_VALIDATION_${Date.now()}`,
  server: null,
  baseUrl: "",
  sppg: null,
  schools: {},
  users: {},
  distributions: {},
  validations: {},
  tokens: {}
};

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
    body: payload,
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

async function createPendingValidation({ key, school, portions }) {
  state.distributions[key] = await prisma.distribution.create({
    data: {
      sppgId: state.sppg.id,
      schoolId: school.id,
      portions,
      pricePerPortion: "13000.00",
      distributionDate: new Date("2026-05-26T00:00:00.000Z"),
      status: "delivered"
    }
  });

  state.validations[key] = await prisma.validation.create({
    data: {
      distributionId: state.distributions[key].id,
      schoolId: school.id,
      receivedPortions: 0,
      qualityOk: null,
      status: "pending"
    }
  });
}

async function setupData() {
  const prefix = state.prefix;

  state.sppg = await prisma.sppg.create({
    data: {
      name: `${prefix} SPPG`,
      province: `${prefix} Province`,
      city: `${prefix} City`,
      capacity: 1000,
      status: "active"
    }
  });

  state.schools.a = await prisma.school.create({
    data: {
      name: `${prefix} School A`,
      province: state.sppg.province,
      city: state.sppg.city,
      sppgId: state.sppg.id,
      totalStudents: 300,
      npsn: `${prefix}_A`
    }
  });
  state.schools.b = await prisma.school.create({
    data: {
      name: `${prefix} School B`,
      province: state.sppg.province,
      city: state.sppg.city,
      sppgId: state.sppg.id,
      totalStudents: 250,
      npsn: `${prefix}_B`
    }
  });

  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: `${prefix} School A User`,
        email: `${prefix}.school.a@example.test`,
        password: "hashed",
        role: "sekolah",
        schoolId: state.schools.a.id
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} School B User`,
        email: `${prefix}.school.b@example.test`,
        password: "hashed",
        role: "sekolah",
        schoolId: state.schools.b.id
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} SPPG User`,
        email: `${prefix}.sppg@example.test`,
        password: "hashed",
        role: "sppg",
        sppgId: state.sppg.id
      }
    })
  ]);

  [state.users.schoolA, state.users.schoolB, state.users.sppg] = users;

  await createPendingValidation({ key: "verified", school: state.schools.a, portions: 300 });
  await createPendingValidation({ key: "conflict", school: state.schools.a, portions: 280 });
  await createPendingValidation({ key: "reported", school: state.schools.a, portions: 310 });
  await createPendingValidation({ key: "otherSchool", school: state.schools.b, portions: 260 });

  state.tokens = {
    schoolA: tokenFor(state.users.schoolA),
    schoolB: tokenFor(state.users.schoolB),
    sppg: tokenFor(state.users.sppg)
  };
}

async function cleanupData() {
  const userIds = Object.values(state.users).map((user) => user?.id).filter(Boolean);
  const validationIds = Object.values(state.validations).map((validation) => validation?.id).filter(Boolean);
  const distributionIds = Object.values(state.distributions).map((distribution) => distribution?.id).filter(Boolean);
  const schoolIds = Object.values(state.schools).map((school) => school?.id).filter(Boolean);
  const sppgIds = [state.sppg?.id].filter(Boolean);

  await prisma.notification.deleteMany({
    where: {
      OR: [
        {
          userId: {
            in: userIds.length ? userIds : [-1]
          }
        },
        ...distributionIds.map((distributionId) => ({
          message: {
            contains: `#${distributionId}`
          }
        }))
      ]
    }
  });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds.length ? userIds : [-1] } },
        { tableName: "validations", recordId: { in: validationIds.length ? validationIds : [-1] } },
        { tableName: "school_reports", userId: { in: userIds.length ? userIds : [-1] } }
      ]
    }
  });
  await prisma.schoolReport.deleteMany({
    where: {
      OR: [
        { schoolId: { in: schoolIds.length ? schoolIds : [-1] } },
        { distributionId: { in: distributionIds.length ? distributionIds : [-1] } }
      ]
    }
  });
  await prisma.anomalyLog.deleteMany({
    where: {
      distributionId: {
        in: distributionIds.length ? distributionIds : [-1]
      }
    }
  });
  await prisma.validation.deleteMany({
    where: {
      id: {
        in: validationIds.length ? validationIds : [-1]
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

describe("PR 5 school validation flow isolated E2E", () => {
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

    const redisClient = getRedisClient();
    if (redisClient) {
      await redisClient.quit().catch(() => {});
    }

    await prisma.$disconnect();
  });

  it("returns 401 without token and 403 for the wrong role", async () => {
    const noTokenResponse = await request(`/api/validations/${state.validations.verified.id}`, {
      method: "PUT",
      body: {
        receivedPortions: 300,
        qualityOk: true,
        status: "verified"
      }
    });
    const sppgResponse = await request(`/api/validations/${state.validations.verified.id}`, {
      method: "PUT",
      token: state.tokens.sppg,
      body: {
        receivedPortions: 300,
        qualityOk: true,
        status: "verified"
      }
    });

    assert.equal(noTokenResponse.status, 401);
    assert.equal(sppgResponse.status, 403);
  });

  it("shows only pending validations for the authenticated school", async () => {
    const response = await request("/api/validations?status=pending&limit=20", {
      token: state.tokens.schoolA
    });

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body?.data));
    assert.ok(response.body.data.some((item) => item.id === state.validations.verified.id));
    assert.ok(response.body.data.some((item) => item.id === state.validations.conflict.id));
    assert.ok(response.body.data.every((item) => item.schoolId === state.schools.a.id));
    assert.ok(response.body.data.every((item) => item.id !== state.validations.otherSchool.id));
  });

  it("marks matching portions and good quality as verified", async () => {
    const response = await request(`/api/validations/${state.validations.verified.id}`, {
      method: "PUT",
      token: state.tokens.schoolA,
      body: {
        receivedPortions: 300,
        qualityOk: true,
        status: "verified",
        notes: "Porsi sesuai dan kualitas baik."
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body?.data?.status, "verified");
    assert.equal(response.body?.data?.receivedPortions, 300);
    assert.equal(response.body?.data?.qualityOk, true);
    assert.ok(response.body?.data?.validatedAt);
  });

  it("marks mismatched portions as conflict and records a conflict anomaly", async () => {
    const response = await request(`/api/validations/${state.validations.conflict.id}`, {
      method: "PUT",
      token: state.tokens.schoolA,
      body: {
        receivedPortions: 250,
        qualityOk: true,
        status: "conflict",
        notes: "Porsi diterima kurang dari porsi diklaim."
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body?.data?.status, "conflict");
    assert.equal(response.body?.data?.receivedPortions, 250);

    const anomaly = await prisma.anomalyLog.findFirst({
      where: {
        distributionId: state.distributions.conflict.id,
        anomalyType: "VALIDATION_CONFLICT"
      }
    });

    assert.ok(anomaly);
  });

  it("turns a school issue report into a non-pending validation visible to SPPG", async () => {
    const response = await request("/api/school-reports", {
      method: "POST",
      token: state.tokens.schoolA,
      body: {
        distributionId: state.distributions.reported.id,
        validationId: state.validations.reported.id,
        category: "keterlambatan",
        message: "Distribusi datang terlambat dan beberapa porsi perlu ditinjau ulang."
      }
    });

    assert.equal(response.status, 201);
    assert.equal(response.body?.data?.distributionId, state.distributions.reported.id);
    assert.equal(response.body?.data?.schoolId, state.schools.a.id);
    assert.equal(response.body?.data?.sppgId, state.sppg.id);

    const validation = await prisma.validation.findUnique({
      where: {
        id: state.validations.reported.id
      }
    });

    assert.equal(validation.status, "issue_reported");
    assert.ok(validation.validatedAt);

    const pendingResponse = await request("/api/validations?status=pending&limit=20", {
      token: state.tokens.schoolA
    });

    assert.equal(pendingResponse.status, 200);
    assert.ok(pendingResponse.body.data.every((item) => item.id !== state.validations.reported.id));

    const sppgReportResponse = await request(`/api/school-reports?distributionId=${state.distributions.reported.id}`, {
      token: state.tokens.sppg
    });

    assert.equal(sppgReportResponse.status, 200);
    assert.equal(sppgReportResponse.body.data.length, 1);
    assert.equal(sppgReportResponse.body.data[0].distributionId, state.distributions.reported.id);

    const validationAudit = await prisma.auditLog.findFirst({
      where: {
        tableName: "validations",
        recordId: state.validations.reported.id,
        action: "UPDATE"
      }
    });
    const reportAudit = await prisma.auditLog.findFirst({
      where: {
        tableName: "school_reports",
        action: "INSERT",
        newData: {
          path: ["distributionId"],
          equals: state.distributions.reported.id
        }
      }
    });

    assert.ok(validationAudit);
    assert.ok(reportAudit);
  });

  it("prevents another school from reading or validating the validation", async () => {
    const readResponse = await request(`/api/validations/${state.validations.verified.id}`, {
      token: state.tokens.schoolB
    });
    const updateResponse = await request(`/api/validations/${state.validations.verified.id}`, {
      method: "PUT",
      token: state.tokens.schoolB,
      body: {
        receivedPortions: 300,
        qualityOk: true,
        status: "verified"
      }
    });

    assert.equal(readResponse.status, 403);
    assert.equal(updateResponse.status, 403);
  });
});
