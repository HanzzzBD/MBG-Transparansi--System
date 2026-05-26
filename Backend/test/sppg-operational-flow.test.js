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
  prefix: `pr4_sppg_${Date.now()}`,
  server: null,
  baseUrl: "",
  sppg: {},
  schools: {},
  users: {},
  thresholds: {},
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

async function setupData() {
  const prefix = state.prefix;

  state.sppg.a = await prisma.sppg.create({
    data: {
      name: `${prefix} SPPG A`,
      province: `${prefix} Province A`,
      city: `${prefix} City A`,
      capacity: 500,
      status: "active"
    }
  });
  state.sppg.b = await prisma.sppg.create({
    data: {
      name: `${prefix} SPPG B`,
      province: `${prefix} Province B`,
      city: `${prefix} City B`,
      capacity: 600,
      status: "active"
    }
  });

  state.schools.a = await prisma.school.create({
    data: {
      name: `${prefix} School A`,
      province: state.sppg.a.province,
      city: state.sppg.a.city,
      sppgId: state.sppg.a.id,
      totalStudents: 250,
      npsn: `${prefix}_school_a`
    }
  });
  state.schools.b = await prisma.school.create({
    data: {
      name: `${prefix} School B`,
      province: state.sppg.b.province,
      city: state.sppg.b.city,
      sppgId: state.sppg.b.id,
      totalStudents: 260,
      npsn: `${prefix}_school_b`
    }
  });

  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: `${prefix} SPPG A`,
        email: `${prefix}.sppg.a@example.test`,
        password: "hashed",
        role: "sppg",
        sppgId: state.sppg.a.id
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} SPPG B`,
        email: `${prefix}.sppg.b@example.test`,
        password: "hashed",
        role: "sppg",
        sppgId: state.sppg.b.id
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} School A`,
        email: `${prefix}.school.a@example.test`,
        password: "hashed",
        role: "sekolah",
        schoolId: state.schools.a.id
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} Admin`,
        email: `${prefix}.admin@example.test`,
        password: "hashed",
        role: "admin"
      }
    })
  ]);

  [state.users.sppgA, state.users.sppgB, state.users.schoolA, state.users.admin] = users;

  state.thresholds.a = await prisma.priceThreshold.create({
    data: {
      province: state.sppg.a.province,
      minPrice: "10000.00",
      maxPrice: "15000.00",
      avgReferencePrice: "12500.00",
      source: "test",
      generatedFromFoodPrices: false
    }
  });
  state.thresholds.b = await prisma.priceThreshold.create({
    data: {
      province: state.sppg.b.province,
      minPrice: "11000.00",
      maxPrice: "16000.00",
      avgReferencePrice: "13500.00",
      source: "test",
      generatedFromFoodPrices: false
    }
  });

  state.tokens = {
    sppgA: tokenFor(state.users.sppgA),
    sppgB: tokenFor(state.users.sppgB),
    schoolA: tokenFor(state.users.schoolA),
    admin: tokenFor(state.users.admin)
  };
}

async function cleanupData() {
  const userIds = Object.values(state.users).map((user) => user?.id).filter(Boolean);
  const schoolIds = Object.values(state.schools).map((school) => school?.id).filter(Boolean);
  const sppgIds = Object.values(state.sppg).map((sppg) => sppg?.id).filter(Boolean);
  const thresholdIds = Object.values(state.thresholds).map((threshold) => threshold?.id).filter(Boolean);

  await prisma.priceThreshold.deleteMany({
    where: {
      id: {
        in: thresholdIds.length ? thresholdIds : [-1]
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

describe("PR 4 SPPG operational flow", () => {
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

  it("returns 401 for SPPG operational endpoints without token", async () => {
    const schoolsResponse = await request("/api/sppg/me/schools");
    const thresholdResponse = await request("/api/price-thresholds/my-region");

    assert.equal(schoolsResponse.status, 401);
    assert.equal(thresholdResponse.status, 401);
  });

  it("returns only schools assigned to the authenticated SPPG", async () => {
    const response = await request("/api/sppg/me/schools?limit=20", {
      token: state.tokens.sppgA
    });

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body?.data));
    assert.ok(response.body.data.some((school) => school.id === state.schools.a.id));
    assert.ok(response.body.data.every((school) => school.id !== state.schools.b.id));
    assert.ok(response.body.data.every((school) => Number(school.total_students) === Number(school.totalStudents)));
  });

  it("does not expose schools from another SPPG through search", async () => {
    const response = await request(`/api/sppg/me/schools?search=${encodeURIComponent(state.schools.b.name)}`, {
      token: state.tokens.sppgA
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body?.data, []);
  });

  it("rejects non-SPPG roles from assigned school endpoint", async () => {
    const schoolResponse = await request("/api/sppg/me/schools", {
      token: state.tokens.schoolA
    });
    const adminResponse = await request("/api/sppg/me/schools", {
      token: state.tokens.admin
    });

    assert.equal(schoolResponse.status, 403);
    assert.equal(adminResponse.status, 403);
  });

  it("allows SPPG to read the price threshold for its own province only", async () => {
    const response = await request("/api/price-thresholds/my-region", {
      token: state.tokens.sppgA
    });

    assert.equal(response.status, 200);
    assert.equal(response.body?.data?.province, state.sppg.a.province);
    assert.equal(Number(response.body?.data?.maxPrice), 15000);
    assert.equal(response.body?.data?.updatedByUser, undefined);
    assert.equal(response.body?.data?.email, undefined);
  });

  it("does not allow SPPG to mutate price thresholds", async () => {
    const response = await request("/api/price-thresholds/generate-from-food-prices", {
      method: "POST",
      token: state.tokens.sppgA
    });

    assert.equal(response.status, 403);
  });

  it("rejects school role from SPPG threshold endpoint", async () => {
    const response = await request("/api/price-thresholds/my-region", {
      token: state.tokens.schoolA
    });

    assert.equal(response.status, 403);
  });
});
