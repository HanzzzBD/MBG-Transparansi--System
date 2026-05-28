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
  menus: {},
  schools: {},
  dapodikSchools: {},
  assignments: {},
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

  state.assignments.a = await prisma.sppgSchoolAssignment.create({
    data: {
      sppgId: state.sppg.a.id,
      schoolId: state.schools.a.id,
      status: "active"
    }
  });
  state.assignments.b = await prisma.sppgSchoolAssignment.create({
    data: {
      sppgId: state.sppg.b.id,
      schoolId: state.schools.b.id,
      status: "active"
    }
  });

  state.dapodikSchools.unassigned = await prisma.dapodikSchool.create({
    data: {
      semesterId: `${prefix}_semester`,
      dapodikSchoolId: `${prefix}_dapodik_unassigned`,
      npsn: `${prefix}_dapodik_unassigned_npsn`,
      name: `${prefix} Dapodik School Unassigned`,
      province: state.sppg.a.province,
      city: state.sppg.a.city,
      district: `${prefix} District A`,
      educationLevel: "SMA",
      schoolStatus: "Negeri",
      studentCount: 300,
      rawData: {},
      fetchedAt: new Date()
    }
  });
  state.dapodikSchools.assignedB = await prisma.dapodikSchool.create({
    data: {
      semesterId: `${prefix}_semester`,
      dapodikSchoolId: `${prefix}_dapodik_assigned_b`,
      npsn: `${prefix}_dapodik_assigned_b_npsn`,
      name: `${prefix} Dapodik School Assigned B`,
      province: state.sppg.b.province,
      city: state.sppg.b.city,
      district: `${prefix} District B`,
      educationLevel: "SMP",
      schoolStatus: "Negeri",
      studentCount: 280,
      rawData: {},
      fetchedAt: new Date()
    }
  });
  state.schools.fromDapodikB = await prisma.school.create({
    data: {
      name: state.dapodikSchools.assignedB.name,
      province: state.sppg.b.province,
      city: state.sppg.b.city,
      district: state.dapodikSchools.assignedB.district,
      sppgId: state.sppg.b.id,
      totalStudents: 280,
      npsn: state.dapodikSchools.assignedB.npsn,
      dapodikSchoolId: state.dapodikSchools.assignedB.dapodikSchoolId,
      dapodikLink: {
        create: {
          dapodikSchoolRecordId: state.dapodikSchools.assignedB.id
        }
      }
    }
  });
  state.assignments.fromDapodikB = await prisma.sppgSchoolAssignment.create({
    data: {
      sppgId: state.sppg.b.id,
      schoolId: state.schools.fromDapodikB.id,
      status: "active"
    }
  });

  state.menus.a = await prisma.menu.create({
    data: {
      sppgId: state.sppg.a.id,
      menuDate: new Date("2026-05-26"),
      menuName: `${prefix} Verified Menu A`,
      items: ["Nasi", "Telur", "Sayur"],
      manualPricePerPortion: "12000.00",
      priceValidationStatus: "VERIFIED",
      priceValidatedAt: new Date()
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
    }),
    prisma.user.create({
      data: {
        name: `${prefix} Pemerintah`,
        email: `${prefix}.gov@example.test`,
        password: "hashed",
        role: "pemerintah"
      }
    })
  ]);

  [state.users.sppgA, state.users.sppgB, state.users.schoolA, state.users.admin, state.users.gov] = users;

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
    admin: tokenFor(state.users.admin),
    gov: tokenFor(state.users.gov)
  };
}

async function cleanupData() {
  const userIds = Object.values(state.users).map((user) => user?.id).filter(Boolean);
  const schoolIds = Object.values(state.schools).map((school) => school?.id).filter(Boolean);
  const dapodikSchoolIds = Object.values(state.dapodikSchools).map((school) => school?.id).filter(Boolean);
  const sppgIds = Object.values(state.sppg).map((sppg) => sppg?.id).filter(Boolean);
  const thresholdIds = Object.values(state.thresholds).map((threshold) => threshold?.id).filter(Boolean);
  const menuIds = Object.values(state.menus).map((menu) => menu?.id).filter(Boolean);

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
  await prisma.auditLog.deleteMany({
    where: {
      tableName: {
        in: ["sppg_school_assignments", "distributions"]
      },
      OR: [
        {
          userId: {
            in: userIds.length ? userIds : [-1]
          }
        },
        {
          recordId: {
            in: Object.values(state.assignments).map((assignment) => assignment?.id).filter(Boolean)
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
      schoolId: {
        in: schoolIds.length ? schoolIds : [-1]
      }
    }
  });
  await prisma.distribution.deleteMany({
    where: {
      OR: [
        {
          schoolId: {
            in: schoolIds.length ? schoolIds : [-1]
          }
        },
        {
          sppgId: {
            in: sppgIds.length ? sppgIds : [-1]
          }
        }
      ]
    }
  });
  await prisma.menu.deleteMany({
    where: {
      id: {
        in: menuIds.length ? menuIds : [-1]
      }
    }
  });
  await prisma.sppgSchoolAssignment.deleteMany({
    where: {
      OR: [
        {
          schoolId: {
            in: schoolIds.length ? schoolIds : [-1]
          }
        },
        {
          sppgId: {
            in: sppgIds.length ? sppgIds : [-1]
          }
        }
      ]
    }
  });
  await prisma.schoolDapodikLink.deleteMany({
    where: {
      OR: [
        {
          schoolId: {
            in: schoolIds.length ? schoolIds : [-1]
          }
        },
        {
          dapodikSchoolRecordId: {
            in: dapodikSchoolIds.length ? dapodikSchoolIds : [-1]
          }
        }
      ]
    }
  });
  await prisma.school.deleteMany({
    where: {
      id: {
        in: schoolIds.length ? schoolIds : [-1]
      }
    }
  });
  await prisma.dapodikSchool.deleteMany({
    where: {
      id: {
        in: dapodikSchoolIds.length ? dapodikSchoolIds : [-1]
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
    const assignResponse = await request("/api/sppg/me/schools/assign", {
      method: "POST",
      body: {
        dapodikSchoolId: state.dapodikSchools.unassigned.id
      }
    });
    const thresholdResponse = await request("/api/price-thresholds/my-region");

    assert.equal(schoolsResponse.status, 401);
    assert.equal(assignResponse.status, 401);
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

  it("rejects non-SPPG roles from self-service assignment endpoint", async () => {
    const schoolResponse = await request("/api/sppg/me/schools/assign", {
      method: "POST",
      token: state.tokens.schoolA,
      body: {
        dapodikSchoolId: state.dapodikSchools.unassigned.id
      }
    });
    const govResponse = await request("/api/sppg/me/schools/assign", {
      method: "POST",
      token: state.tokens.gov,
      body: {
        dapodikSchoolId: state.dapodikSchools.unassigned.id
      }
    });

    assert.equal(schoolResponse.status, 403);
    assert.equal(govResponse.status, 403);
  });

  it("lets SPPG search paginated Dapodik schools without raw payloads", async () => {
    const response = await request(`/api/sppg/me/dapodik-schools?search=${encodeURIComponent("Dapodik School")}&limit=10`, {
      token: state.tokens.sppgA
    });

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body?.data));
    assert.ok(response.body.data.some((school) => school.id === state.dapodikSchools.unassigned.id));
    assert.ok(response.body.data.some((school) => school.assignedSppgName === state.sppg.b.name));
    assert.equal(response.body.data.some((school) => Object.hasOwn(school, "rawData")), false);
  });

  it("ranks Dapodik search by relevance for partial and fuzzy terms", async () => {
    const [lessRelevant, mostRelevant] = await Promise.all([
      prisma.dapodikSchool.create({
        data: {
          semesterId: "20252",
          dapodikSchoolId: `${state.prefix}_rank_smkn2`,
          npsn: `${state.prefix}_rank_2`,
          name: `${state.prefix} SMKN 2 BALEENDAH`,
          province: "Jawa Barat",
          city: "Bandung",
          district: "Baleendah",
          educationLevel: "SMK",
          schoolStatus: "Negeri",
          studentCount: 0,
          sourceHash: "contains-4-but-low-priority",
          rawData: {},
          fetchedAt: new Date()
        }
      }),
      prisma.dapodikSchool.create({
        data: {
          semesterId: "20252",
          dapodikSchoolId: `${state.prefix}_rank_smkn4`,
          npsn: `${state.prefix}_rank_4`,
          name: `${state.prefix} SMKN 4 BANDUNG`,
          province: "Jawa Barat",
          city: "Bandung",
          district: "Baleendah",
          educationLevel: "SMK",
          schoolStatus: "Negeri",
          studentCount: 0,
          rawData: {},
          fetchedAt: new Date()
        }
      })
    ]);
    state.dapodikSchools.ranking2 = lessRelevant;
    state.dapodikSchools.ranking4 = mostRelevant;

    const response = await request(
      `/api/dapodik/staged-schools?semester_id=20252&search=${encodeURIComponent(`${state.prefix} SMKN 4 Bandung`)}&limit=5`,
      {
        token: state.tokens.admin
      }
    );

    assert.equal(response.status, 200);
    assert.equal(response.body?.data?.[0]?.id, mostRelevant.id);
    assert.equal(response.body?.meta?.searchMode, "partial_fuzzy_ranked");
  });

  it("requires every search token and supports school aliases", async () => {
    const marker = "ketatsearchalpha";
    const [smkn7, smkNegeri4] = await Promise.all([
      prisma.dapodikSchool.create({
        data: {
          semesterId: "20252",
          dapodikSchoolId: `${marker}_strict_smkn_tujuh`,
          npsn: `${marker}_strict_tujuh`,
          name: `${marker} SMKN 7 BALEENDAH`,
          province: "Jawa Barat",
          city: "Kabupaten Bandung",
          district: "Baleendah",
          educationLevel: "SMK",
          schoolStatus: "Negeri",
          studentCount: 0,
          rawData: {},
          fetchedAt: new Date()
        }
      }),
      prisma.dapodikSchool.create({
        data: {
          semesterId: "20252",
          dapodikSchoolId: `${marker}_strict_smkn_empat`,
          npsn: `${marker}_strict_empat`,
          name: `${marker} SMK NEGERI 4 BANDUNG`,
          province: "Jawa Barat",
          city: "Kota Bandung",
          district: "Cijagra",
          educationLevel: "SMK",
          schoolStatus: "Negeri",
          studentCount: 0,
          rawData: {},
          fetchedAt: new Date()
        }
      })
    ]);
    state.dapodikSchools.strict7 = smkn7;
    state.dapodikSchools.strict4 = smkNegeri4;

    const exact = await request(
      `/api/dapodik/staged-schools?semester_id=20252&search=${encodeURIComponent(`${marker} SMKN 4 Bandung`)}&limit=10`,
      {
        token: state.tokens.admin
      }
    );
    const impossible = await request(
      `/api/dapodik/staged-schools?semester_id=20252&search=${encodeURIComponent(`${marker} Cijagra xxx`)}&limit=10`,
      {
        token: state.tokens.admin
      }
    );

    assert.equal(exact.status, 200);
    assert.equal(exact.body?.data?.[0]?.id, smkNegeri4.id);
    assert.equal(exact.body?.data?.some((item) => item.id === smkn7.id), false);
    assert.equal(impossible.status, 200);
    assert.deepEqual(impossible.body?.data, []);
  });

  it("assigns Dapodik school to the authenticated SPPG and avoids duplicates", async () => {
    const first = await request("/api/sppg/me/schools/assign", {
      method: "POST",
      token: state.tokens.sppgA,
      body: {
        dapodikSchoolId: state.dapodikSchools.unassigned.id,
        notes: "Sekolah saluran test"
      }
    });
    const second = await request("/api/sppg/me/schools/assign", {
      method: "POST",
      token: state.tokens.sppgA,
      body: {
        dapodikSchoolId: state.dapodikSchools.unassigned.id
      }
    });

    assert.equal(first.status, 200);
    assert.equal(first.body?.data?.[0]?.status, "assigned");
    assert.equal(second.status, 200);
    assert.equal(second.body?.data?.[0]?.status, "skipped_already_assigned");

    const assignmentCount = await prisma.sppgSchoolAssignment.count({
      where: {
        schoolId: first.body.data[0].schoolId,
        status: "active"
      }
    });
    const auditCount = await prisma.auditLog.count({
      where: {
        tableName: "sppg_school_assignments",
        recordId: first.body.data[0].assignmentId,
        action: "INSERT"
      }
    });

    assert.equal(assignmentCount, 1);
    assert.equal(auditCount, 1);
    state.schools.fromDapodikA = { id: first.body.data[0].schoolId };
    state.assignments.fromDapodikA = { id: first.body.data[0].assignmentId };
  });

  it("does not let SPPG take a school already assigned to another SPPG", async () => {
    const response = await request("/api/sppg/me/schools/assign", {
      method: "POST",
      token: state.tokens.sppgA,
      body: {
        dapodikSchoolId: state.dapodikSchools.assignedB.id
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body?.data?.[0]?.status, "skipped_already_assigned");

    const school = await prisma.school.findUnique({
      where: {
        id: state.schools.fromDapodikB.id
      }
    });
    assert.equal(school.sppgId, state.sppg.b.id);
  });

  it("requires an active school assignment before creating SPPG distribution", async () => {
    const rejected = await request("/api/distributions", {
      method: "POST",
      token: state.tokens.sppgA,
      body: {
        schoolId: state.schools.b.id,
        menuId: state.menus.a.id,
        portions: 40,
        pricePerPortion: 12000,
        distributionDate: "2026-05-26"
      }
    });
    const accepted = await request("/api/distributions", {
      method: "POST",
      token: state.tokens.sppgA,
      body: {
        schoolId: state.schools.a.id,
        menuId: state.menus.a.id,
        portions: 40,
        pricePerPortion: 12000,
        distributionDate: "2026-05-26"
      }
    });

    assert.equal(rejected.status, 403);
    assert.equal(rejected.body?.code, "SCHOOL_NOT_ASSIGNED_TO_SPPG");
    assert.equal(accepted.status, 201);
  });

  it("unassigns an active school assignment and writes audit log", async () => {
    const dapodik = await prisma.dapodikSchool.create({
      data: {
        semesterId: `${state.prefix}_semester`,
        dapodikSchoolId: `${state.prefix}_dapodik_unassign`,
        npsn: `${state.prefix}_dapodik_unassign_npsn`,
        name: `${state.prefix} Dapodik School Unassign`,
        province: state.sppg.a.province,
        city: state.sppg.a.city,
        district: `${state.prefix} District A`,
        educationLevel: "SD",
        schoolStatus: "Negeri",
        studentCount: 120,
        rawData: {},
        fetchedAt: new Date()
      }
    });
    state.dapodikSchools.unassign = dapodik;

    const assigned = await request("/api/sppg/me/schools/assign", {
      method: "POST",
      token: state.tokens.sppgA,
      body: {
        dapodikSchoolId: dapodik.id
      }
    });
    const assignmentId = assigned.body?.data?.[0]?.assignmentId;
    state.assignments.unassign = { id: assignmentId };
    state.schools.unassign = { id: assigned.body?.data?.[0]?.schoolId };

    const response = await request(`/api/sppg/me/schools/${assignmentId}/unassign`, {
      method: "PATCH",
      token: state.tokens.sppgA,
      body: {
        reason: "Tidak lagi masuk area distribusi"
      }
    });
    const auditCount = await prisma.auditLog.count({
      where: {
        tableName: "sppg_school_assignments",
        recordId: assignmentId,
        action: "UPDATE"
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body?.data?.assignmentStatus, "inactive");
    assert.equal(auditCount, 1);
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
