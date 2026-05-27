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
  prefix: `pr3_dashboard_${Date.now()}`,
  server: null,
  baseUrl: "",
  sppg: {},
  schools: {},
  users: {},
  distributions: {},
  schoolReports: {},
  publicReports: {},
  issues: {},
  notifications: {},
  tokens: {}
};

async function request(path, { token } = {}) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${state.baseUrl}${path}`, {
    headers
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

function flattenResults(data) {
  return [
    ...(data?.sppg || []),
    ...(data?.schools || []),
    ...(data?.distributions || []),
    ...(data?.reports || [])
  ];
}

async function setupData() {
  const prefix = state.prefix;

  state.sppg.alpha = await prisma.sppg.create({
    data: {
      name: `${prefix} Alpha Kitchen`,
      province: "Jawa Barat",
      city: "Bandung",
      capacity: 500,
      status: "active"
    }
  });
  state.sppg.beta = await prisma.sppg.create({
    data: {
      name: `${prefix} Beta Kitchen`,
      province: "Jawa Tengah",
      city: "Semarang",
      capacity: 600,
      status: "active"
    }
  });

  state.schools.alpha = await prisma.school.create({
    data: {
      name: `${prefix} Alpha School`,
      province: "Jawa Barat",
      city: "Bandung",
      sppgId: state.sppg.alpha.id,
      totalStudents: 200,
      npsn: `${prefix}_alpha`
    }
  });
  state.schools.beta = await prisma.school.create({
    data: {
      name: `${prefix} Beta School`,
      province: "Jawa Tengah",
      city: "Semarang",
      sppgId: state.sppg.beta.id,
      totalStudents: 210,
      npsn: `${prefix}_beta`
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
        name: `${prefix} SPPG Alpha`,
        email: `${prefix}.sppg.alpha@example.test`,
        password: "hashed",
        role: "sppg",
        sppgId: state.sppg.alpha.id
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} School Alpha`,
        email: `${prefix}.school.alpha@example.test`,
        password: "hashed",
        role: "sekolah",
        schoolId: state.schools.alpha.id
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} School Beta`,
        email: `${prefix}.school.beta@example.test`,
        password: "hashed",
        role: "sekolah",
        schoolId: state.schools.beta.id
      }
    }),
    prisma.user.create({
      data: {
        name: `${prefix} Public User`,
        email: `${prefix}.public@example.test`,
        password: "hashed",
        role: "umum"
      }
    })
  ]);

  [state.users.admin, state.users.gov, state.users.sppgAlpha, state.users.schoolAlpha, state.users.schoolBeta, state.users.public] =
    users;

  state.distributions.alpha = await prisma.distribution.create({
    data: {
      sppgId: state.sppg.alpha.id,
      schoolId: state.schools.alpha.id,
      portions: 200,
      pricePerPortion: "15000.00",
      distributionDate: new Date("2026-05-25T00:00:00.000Z"),
      status: "delivered"
    }
  });
  state.distributions.beta = await prisma.distribution.create({
    data: {
      sppgId: state.sppg.beta.id,
      schoolId: state.schools.beta.id,
      portions: 210,
      pricePerPortion: "16000.00",
      distributionDate: new Date("2026-05-25T00:00:00.000Z"),
      status: "delivered"
    }
  });

  state.schoolReports.alpha = await prisma.schoolReport.create({
    data: {
      schoolId: state.schools.alpha.id,
      reportedBy: state.users.schoolAlpha.id,
      category: "kualitas_makanan",
      message: `${prefix} Alpha school report`
    }
  });
  state.publicReports.alpha = await prisma.publicReport.create({
    data: {
      category: "keterlambatan",
      message: `${prefix} Public report alpha`,
      province: "Jawa Barat",
      city: "Bandung"
    }
  });
  state.issues.alpha = await prisma.issue.create({
    data: {
      sppgId: state.sppg.alpha.id,
      reportedBy: state.users.sppgAlpha.id,
      category: "logistik",
      description: `${prefix} Alpha issue`,
      status: "open"
    }
  });

  state.notifications.alpha = await prisma.notification.create({
    data: {
      userId: state.users.schoolAlpha.id,
      type: "distribution",
      title: `${prefix} Alpha notification`,
      message: "Distribusi sekolah alpha perlu dicek.",
      payload: {
        distributionId: state.distributions.alpha.id
      }
    }
  });
  state.notifications.beta = await prisma.notification.create({
    data: {
      userId: state.users.schoolBeta.id,
      type: "distribution",
      title: `${prefix} Beta notification`,
      message: "Distribusi sekolah beta perlu dicek.",
      payload: {
        distributionId: state.distributions.beta.id
      }
    }
  });

  state.tokens = {
    admin: tokenFor(state.users.admin),
    gov: tokenFor(state.users.gov),
    sppgAlpha: tokenFor(state.users.sppgAlpha),
    schoolAlpha: tokenFor(state.users.schoolAlpha),
    public: tokenFor(state.users.public)
  };
}

async function cleanupData() {
  const userIds = Object.values(state.users).map((user) => user?.id).filter(Boolean);
  const sppgIds = Object.values(state.sppg).map((sppg) => sppg?.id).filter(Boolean);
  const schoolIds = Object.values(state.schools).map((school) => school?.id).filter(Boolean);
  const distributionIds = Object.values(state.distributions).map((distribution) => distribution?.id).filter(Boolean);
  const schoolReportIds = Object.values(state.schoolReports).map((report) => report?.id).filter(Boolean);
  const publicReportIds = Object.values(state.publicReports).map((report) => report?.id).filter(Boolean);
  const issueIds = Object.values(state.issues).map((issue) => issue?.id).filter(Boolean);

  await prisma.auditLog.deleteMany({
    where: {
      userId: {
        in: userIds.length ? userIds : [-1]
      }
    }
  });
  await prisma.notification.deleteMany({
    where: {
      userId: {
        in: userIds.length ? userIds : [-1]
      }
    }
  });
  await prisma.issue.deleteMany({
    where: {
      id: {
        in: issueIds.length ? issueIds : [-1]
      }
    }
  });
  await prisma.publicReport.deleteMany({
    where: {
      id: {
        in: publicReportIds.length ? publicReportIds : [-1]
      }
    }
  });
  await prisma.schoolReport.deleteMany({
    where: {
      id: {
        in: schoolReportIds.length ? schoolReportIds : [-1]
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

describe("PR 3 dashboard polish endpoints", () => {
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

  it("requires an authenticated dashboard role for global search", async () => {
    const noToken = await request(`/api/search?q=${encodeURIComponent(state.prefix)}`);
    assert.equal(noToken.status, 401);

    const wrongRole = await request(`/api/search?q=${encodeURIComponent(state.prefix)}`, {
      token: state.tokens.public
    });
    assert.equal(wrongRole.status, 403);
  });

  it("returns grouped search results for admin and government roles", async () => {
    const response = await request(`/api/search?q=${encodeURIComponent(`${state.prefix} Alpha`)}&limit=5`, {
      token: state.tokens.admin
    });

    assert.equal(response.status, 200);
    assert.ok(response.body?.data?.sppg?.some((item) => item.id === String(state.sppg.alpha.id)));
    assert.ok(response.body?.data?.schools?.some((item) => item.id === String(state.schools.alpha.id)));
    assert.ok(response.body?.data?.distributions?.some((item) => item.id === String(state.distributions.alpha.id)));
    assert.ok(response.body?.data?.reports?.length > 0);

    const govResponse = await request(`/api/search?q=${encodeURIComponent(`${state.prefix} Public`)}&limit=5`, {
      token: state.tokens.gov
    });

    assert.equal(govResponse.status, 200);
    assert.ok(govResponse.body?.data?.reports?.some((item) => item.entity === "public_report"));
  });

  it("matches search terms across different fields like a smart table search", async () => {
    const response = await request(`/api/search?q=${encodeURIComponent(`${state.prefix}, Bandung`)}&limit=5`, {
      token: state.tokens.admin
    });

    assert.equal(response.status, 200);
    assert.ok(response.body?.data?.sppg?.some((item) => item.id === String(state.sppg.alpha.id)));
    assert.ok(response.body?.data?.schools?.some((item) => item.id === String(state.schools.alpha.id)));
    assert.equal(response.body?.data?.sppg?.some((item) => item.id === String(state.sppg.beta.id)), false);
  });

  it("does not leak other SPPG data through global search", async () => {
    const alphaResponse = await request(`/api/search?q=${encodeURIComponent(`${state.prefix} Alpha`)}&limit=5`, {
      token: state.tokens.sppgAlpha
    });
    const betaResponse = await request(`/api/search?q=${encodeURIComponent(`${state.prefix} Beta`)}&limit=5`, {
      token: state.tokens.sppgAlpha
    });

    assert.equal(alphaResponse.status, 200);
    assert.ok(flattenResults(alphaResponse.body?.data).length > 0);
    assert.equal(flattenResults(betaResponse.body?.data).length, 0);
  });

  it("does not leak other school data through global search", async () => {
    const alphaResponse = await request(`/api/search?q=${encodeURIComponent(`${state.prefix} Alpha`)}&limit=5`, {
      token: state.tokens.schoolAlpha
    });
    const betaResponse = await request(`/api/search?q=${encodeURIComponent(`${state.prefix} Beta`)}&limit=5`, {
      token: state.tokens.schoolAlpha
    });

    assert.equal(alphaResponse.status, 200);
    assert.ok(flattenResults(alphaResponse.body?.data).length > 0);
    assert.equal(flattenResults(betaResponse.body?.data).length, 0);
  });

  it("returns only the authenticated user's notifications", async () => {
    const response = await request("/api/notifications?limit=10", {
      token: state.tokens.schoolAlpha
    });

    assert.equal(response.status, 200);
    assert.equal(response.body?.meta?.unreadCount, 1);
    assert.equal(response.body?.data?.some((item) => item.id === state.notifications.alpha.id), true);
    assert.equal(response.body?.data?.some((item) => item.id === state.notifications.beta.id), false);
    assert.ok(response.body?.data?.[0]?.created_at);
    assert.equal(response.body?.data?.[0]?.is_read, false);
  });
});
