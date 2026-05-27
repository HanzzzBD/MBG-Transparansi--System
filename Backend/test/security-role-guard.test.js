process.env.NODE_ENV = process.env.NODE_ENV || "test";

const assert = require("node:assert/strict");
const http = require("node:http");
const { after, before, describe, it } = require("node:test");

const bcrypt = require("bcrypt");

const app = require("../src/app");
const { getPrismaClient } = require("../src/config/prisma");
const { getRedisClient } = require("../src/config/redis");
const { BCRYPT_ROUNDS, REFRESH_TOKEN_COOKIE_NAME, signAccessToken } = require("../src/utils/auth");

const prisma = getPrismaClient();

const TEST_PASSWORD = "TestPass123!";

const state = {
  prefix: `pr1_idor_${Date.now()}`,
  server: null,
  baseUrl: "",
  sppg: {},
  schools: {},
  users: {},
  distributions: {},
  validations: {},
  schoolReports: {},
  createdSchoolReportIds: [],
  tokens: {}
};

function getCookiePairs(headers) {
  const setCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);

  return setCookies.map((cookie) => cookie.split(";")[0]).filter(Boolean);
}

async function request(path, { method = "GET", token, cookie, body } = {}) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (cookie) {
    headers.Cookie = cookie;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${state.baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

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

async function setupData() {
  const password = await bcrypt.hash(TEST_PASSWORD, BCRYPT_ROUNDS);
  const prefix = state.prefix;

  state.sppg.a = await prisma.sppg.create({
    data: {
      name: `${prefix} SPPG A`,
      province: "Jawa Barat",
      city: "Bandung",
      capacity: 500,
      status: "active"
    }
  });
  state.sppg.b = await prisma.sppg.create({
    data: {
      name: `${prefix} SPPG B`,
      province: "Jawa Tengah",
      city: "Semarang",
      capacity: 600,
      status: "active"
    }
  });

  state.schools.a = await prisma.school.create({
    data: {
      name: `${prefix} School A`,
      province: "Jawa Barat",
      city: "Bandung",
      sppgId: state.sppg.a.id,
      totalStudents: 250,
      npsn: `${prefix}_a`
    }
  });
  state.schools.b = await prisma.school.create({
    data: {
      name: `${prefix} School B`,
      province: "Jawa Tengah",
      city: "Semarang",
      sppgId: state.sppg.b.id,
      totalStudents: 260,
      npsn: `${prefix}_b`
    }
  });

  const userRows = await Promise.all([
    prisma.user.create({
      data: {
        name: `${prefix} SPPG A`,
        email: `${prefix}.sppg.a@example.test`,
        password,
        role: "sppg",
        sppgId: state.sppg.a.id
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} SPPG B`,
        email: `${prefix}.sppg.b@example.test`,
        password,
        role: "sppg",
        sppgId: state.sppg.b.id
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} School A`,
        email: `${prefix}.school.a@example.test`,
        password,
        role: "sekolah",
        schoolId: state.schools.a.id
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} School B`,
        email: `${prefix}.school.b@example.test`,
        password,
        role: "sekolah",
        schoolId: state.schools.b.id
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} Government`,
        email: `${prefix}.gov@example.test`,
        password,
        role: "pemerintah"
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} Admin`,
        email: `${prefix}.admin@example.test`,
        password,
        role: "admin"
      }
    })
  ]);

  [state.users.sppgA, state.users.sppgB, state.users.schoolA, state.users.schoolB, state.users.gov, state.users.admin] =
    userRows;

  state.distributions.a = await prisma.distribution.create({
    data: {
      sppgId: state.sppg.a.id,
      schoolId: state.schools.a.id,
      portions: 200,
      pricePerPortion: "15000.00",
      distributionDate: new Date("2026-05-25T00:00:00.000Z"),
      status: "delivered"
    }
  });
  state.distributions.b = await prisma.distribution.create({
    data: {
      sppgId: state.sppg.b.id,
      schoolId: state.schools.b.id,
      portions: 210,
      pricePerPortion: "16000.00",
      distributionDate: new Date("2026-05-25T00:00:00.000Z"),
      status: "delivered"
    }
  });

  state.validations.a = await prisma.validation.create({
    data: {
      distributionId: state.distributions.a.id,
      schoolId: state.schools.a.id,
      receivedPortions: 200,
      qualityOk: true,
      status: "verified",
      validatedAt: new Date()
    }
  });
  state.validations.b = await prisma.validation.create({
    data: {
      distributionId: state.distributions.b.id,
      schoolId: state.schools.b.id,
      receivedPortions: 210,
      qualityOk: true,
      status: "verified",
      validatedAt: new Date()
    }
  });

  state.schoolReports.a = await prisma.schoolReport.create({
    data: {
      schoolId: state.schools.a.id,
      reportedBy: state.users.schoolA.id,
      category: "kualitas_makanan",
      message: `${prefix} report A`
    }
  });
  state.schoolReports.b = await prisma.schoolReport.create({
    data: {
      schoolId: state.schools.b.id,
      reportedBy: state.users.schoolB.id,
      category: "kualitas_makanan",
      message: `${prefix} report B`
    }
  });

  state.tokens = {
    sppgA: tokenFor(state.users.sppgA),
    schoolA: tokenFor(state.users.schoolA),
    gov: tokenFor(state.users.gov),
    admin: tokenFor(state.users.admin)
  };
}

async function cleanupData() {
  const userIds = Object.values(state.users)
    .map((user) => user?.id)
    .filter(Boolean);
  const schoolReportIds = [
    ...Object.values(state.schoolReports).map((report) => report?.id),
    ...state.createdSchoolReportIds
  ].filter(Boolean);
  const distributionIds = Object.values(state.distributions)
    .map((distribution) => distribution?.id)
    .filter(Boolean);
  const validationIds = Object.values(state.validations)
    .map((validation) => validation?.id)
    .filter(Boolean);
  const schoolIds = Object.values(state.schools)
    .map((school) => school?.id)
    .filter(Boolean);
  const sppgIds = Object.values(state.sppg)
    .map((sppg) => sppg?.id)
    .filter(Boolean);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds.length ? userIds : [-1] } },
        { tableName: "school_reports", recordId: { in: schoolReportIds.length ? schoolReportIds : [-1] } }
      ]
    }
  });
  await prisma.loginAttempt.deleteMany({
    where: {
      email: {
        startsWith: state.prefix
      }
    }
  });
  await prisma.schoolReport.deleteMany({
    where: {
      OR: [
        { id: { in: schoolReportIds.length ? schoolReportIds : [-1] } },
        { reportedBy: { in: userIds.length ? userIds : [-1] } }
      ]
    }
  });
  await prisma.validation.deleteMany({
    where: {
      OR: [
        { id: { in: validationIds.length ? validationIds : [-1] } },
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

describe("PR 1 security role guard", () => {
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

  it("sets refresh token as HttpOnly cookie, stores only hashed refresh token, refreshes, and revokes on logout", async () => {
    const loginResponse = await request("/api/auth/login", {
      method: "POST",
      body: {
        email: state.users.admin.email,
        password: TEST_PASSWORD
      }
    });

    assert.equal(loginResponse.status, 200);
    assert.ok(loginResponse.body?.data?.accessToken);
    assert.ok(loginResponse.body?.data?.user);

    const setCookies = getCookiePairs(loginResponse.headers);
    const refreshCookie = setCookies.find((cookie) => cookie.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`));

    assert.ok(refreshCookie, "login response must set refresh cookie");

    const rawSetCookie = loginResponse.headers.get("set-cookie") || "";
    assert.match(rawSetCookie, new RegExp(`${REFRESH_TOKEN_COOKIE_NAME}=`));
    assert.match(rawSetCookie, /HttpOnly/i);
    assert.match(rawSetCookie, /SameSite=Lax/i);
    assert.doesNotMatch(rawSetCookie, /Secure/i);

    const cookieValue = refreshCookie.split("=")[1];
    const session = await prisma.userSession.findFirst({
      where: {
        userId: state.users.admin.id
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    assert.ok(session);
    assert.equal(session.refreshToken.length, 64);
    assert.notEqual(session.refreshToken, cookieValue);

    const sessionResponse = await request("/api/auth/session", {
      method: "POST",
      cookie: refreshCookie
    });

    assert.equal(sessionResponse.status, 200);
    assert.equal(sessionResponse.body?.data?.authenticated, true);
    assert.ok(sessionResponse.body?.data?.accessToken);
    assert.equal(sessionResponse.body?.data?.user?.id, state.users.admin.id);

    const refreshResponse = await request("/api/auth/refresh", {
      method: "POST",
      cookie: refreshCookie
    });

    assert.equal(refreshResponse.status, 200);
    assert.ok(refreshResponse.body?.data?.accessToken);
    assert.equal(refreshResponse.body?.data?.user?.id, state.users.admin.id);

    const logoutResponse = await request("/api/auth/logout", {
      method: "POST",
      cookie: refreshCookie
    });

    assert.equal(logoutResponse.status, 200);
    assert.match(logoutResponse.headers.get("set-cookie") || "", new RegExp(`${REFRESH_TOKEN_COOKIE_NAME}=`));

    const revokedSession = await prisma.userSession.findUnique({
      where: {
        id: session.id
      }
    });

    assert.equal(revokedSession.isRevoked, true);
  });

  it("returns an anonymous session state without 401 when no refresh cookie exists", async () => {
    const response = await request("/api/auth/session", {
      method: "POST"
    });

    assert.equal(response.status, 200);
    assert.equal(response.body?.data?.authenticated, false);
    assert.equal(response.body?.data?.accessToken, null);
    assert.equal(response.body?.data?.user, null);
  });

  it("returns 401 when protected endpoints are called without token", async () => {
    const response = await request(`/api/distributions/${state.distributions.a.id}`);

    assert.equal(response.status, 401);
  });

  it("prevents SPPG A from reading or updating distribution owned by SPPG B", async () => {
    const readResponse = await request(`/api/distributions/${state.distributions.b.id}`, {
      token: state.tokens.sppgA
    });

    assert.equal(readResponse.status, 403);

    const updateResponse = await request(`/api/distributions/${state.distributions.b.id}`, {
      method: "PUT",
      token: state.tokens.sppgA,
      body: {
        portions: 222
      }
    });

    assert.equal(updateResponse.status, 403);
  });

  it("prevents School A from reading or updating validation owned by School B", async () => {
    const readResponse = await request(`/api/validations/${state.validations.b.id}`, {
      token: state.tokens.schoolA
    });

    assert.equal(readResponse.status, 403);

    const updateResponse = await request(`/api/validations/${state.validations.b.id}`, {
      method: "PATCH",
      token: state.tokens.schoolA,
      body: {
        status: "verified",
        receivedPortions: 210
      }
    });

    assert.equal(updateResponse.status, 403);
  });

  it("keeps School A scoped away from School B school reports", async () => {
    const listResponse = await request(`/api/school-reports?schoolId=${state.schools.b.id}&limit=20`, {
      token: state.tokens.schoolA
    });

    assert.equal(listResponse.status, 200);
    assert.ok(Array.isArray(listResponse.body?.data));
    assert.ok(
      listResponse.body.data.every((report) => Number(report.schoolId ?? report.school?.id) === state.schools.a.id)
    );

    const createResponse = await request("/api/school-reports", {
      method: "POST",
      token: state.tokens.schoolA,
      body: {
        schoolId: state.schools.b.id,
        category: "lainnya",
        message: "Sekolah A mencoba mengirim laporan ke schoolId B"
      }
    });

    assert.equal(createResponse.status, 201);
    state.createdSchoolReportIds.push(createResponse.body.data.id);
    assert.equal(Number(createResponse.body.data.schoolId ?? createResponse.body.data.school?.id), state.schools.a.id);
  });

  it("rejects SPPG role from admin and government endpoints", async () => {
    const usersResponse = await request("/api/users", {
      token: state.tokens.sppgA
    });
    const exportsResponse = await request("/api/exports", {
      token: state.tokens.sppgA
    });

    assert.equal(usersResponse.status, 403);
    assert.equal(exportsResponse.status, 403);
  });

  it("rejects school role from SPPG, admin, and government endpoints", async () => {
    const productionResponse = await request("/api/production-batches", {
      token: state.tokens.schoolA
    });
    const usersResponse = await request("/api/users", {
      token: state.tokens.schoolA
    });
    const exportsResponse = await request("/api/exports", {
      token: state.tokens.schoolA
    });

    assert.equal(productionResponse.status, 403);
    assert.equal(usersResponse.status, 403);
    assert.equal(exportsResponse.status, 403);
  });

  it("returns 403 when an authenticated wrong role calls an admin-only distribution lock endpoint", async () => {
    const response = await request(`/api/distributions/${state.distributions.a.id}/lock`, {
      method: "PATCH",
      token: state.tokens.gov,
      body: {
        reason: "Government role must not lock distribution data directly"
      }
    });

    assert.equal(response.status, 403);
  });
});
