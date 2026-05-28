process.env.NODE_ENV = process.env.NODE_ENV || "test";

const assert = require("node:assert/strict");
const http = require("node:http");
const { after, before, describe, it } = require("node:test");

const app = require("../src/app");
const { getPrismaClient } = require("../src/config/prisma");
const { getRedisClient } = require("../src/config/redis");

const prisma = getPrismaClient();

const state = {
  server: null,
  baseUrl: "",
  created: {
    fileId: null,
    menuId: null,
    sppgId: null,
    userId: null
  }
};

const SENSITIVE_KEYS = new Set([
  "phone",
  "email",
  "userId",
  "userAccount",
  "auditLog",
  "anomalyLog",
  "internalNotes",
  "internalReport",
  "lockState",
  "overrideHistory",
  "privateFilePath",
  "token",
  "schoolValidationDetail",
  "picPhone"
]);

async function request(path) {
  const response = await fetch(`${state.baseUrl}${path}`);
  const payload = await response.json().catch(() => null);

  return {
    body: payload,
    status: response.status
  };
}

function collectKeys(value, keys = []) {
  if (!value || typeof value !== "object") return keys;

  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return keys;
  }

  Object.entries(value).forEach(([key, nested]) => {
    keys.push(key);
    collectKeys(nested, keys);
  });

  return keys;
}

describe("PR 2 public feature endpoints", () => {
  before(async () => {
    state.server = http.createServer(app);
    await new Promise((resolve) => {
      state.server.listen(0, "127.0.0.1", resolve);
    });
    state.baseUrl = `http://127.0.0.1:${state.server.address().port}`;
  });

  after(async () => {
    if (state.server) {
      await new Promise((resolve, reject) => {
        state.server.close((error) => (error ? reject(error) : resolve()));
      });
    }

    const redisClient = getRedisClient();
    if (redisClient) {
      await redisClient.quit().catch(() => {});
    }

    await prisma.menu.deleteMany({ where: { id: state.created.menuId || -1 } });
    await prisma.file.deleteMany({ where: { id: state.created.fileId || -1 } });
    await prisma.user.deleteMany({ where: { id: state.created.userId || -1 } });
    await prisma.sppg.deleteMany({ where: { id: state.created.sppgId || -1 } });

    await prisma.$disconnect();
  });

  it("serves public statistics without auth and without sensitive fields", async () => {
    const response = await request("/api/public/statistics");

    assert.equal(response.status, 200);
    assert.equal(response.body?.status, "success");
    assert.ok(response.body?.data?.kpis);
    assert.ok(response.body?.data?.charts);
    assert.ok(response.body?.data?.recentData);
    assert.ok(response.body?.data?.filters);

    const keys = collectKeys(response.body.data);
    assert.equal(keys.some((key) => SENSITIVE_KEYS.has(key)), false);
  });

  it("serves public budget without auth and without sensitive fields", async () => {
    const response = await request("/api/public/budget");

    assert.equal(response.status, 200);
    assert.equal(response.body?.status, "success");
    assert.ok(response.body?.data?.kpis);
    assert.ok(response.body?.data?.charts);
    assert.ok(response.body?.data?.recentData);
    assert.ok(response.body?.data?.filters);

    const keys = collectKeys(response.body.data);
    assert.equal(keys.some((key) => SENSITIVE_KEYS.has(key)), false);
  });

  it("keeps internal SPPG list protected while public SPPG endpoint stays open", async () => {
    const internalResponse = await request("/api/sppg?limit=1");
    const publicResponse = await request("/api/public/sppg?limit=1");

    assert.equal(internalResponse.status, 401);
    assert.equal(internalResponse.body?.code, "AUTH_TOKEN_MISSING");
    assert.equal(publicResponse.status, 200);
    assert.equal(publicResponse.body?.status, "success");
  });

  it("serves public SPPG detail with full menu-safe data and photo URL", async () => {
    const prefix = `Public Menu ${Date.now()}`;
    const sppg = await prisma.sppg.create({
      data: {
        name: `${prefix} SPPG`,
        province: "Jawa Barat",
        city: "Kota Bandung",
        address: "Jl. Publik",
        lat: -6.9,
        lng: 107.6,
        capacity: 1500,
        status: "active"
      }
    });
    state.created.sppgId = sppg.id;

    const uploader = await prisma.user.create({
      data: {
        name: `${prefix} Uploader`,
        email: `${prefix.toLowerCase().replace(/\s+/g, ".")}@example.test`,
        password: "hashed",
        role: "admin",
        isActive: true
      }
    });
    state.created.userId = uploader.id;

    const file = await prisma.file.create({
      data: {
        originalName: "menu-kamis.jpg",
        storedName: `${prefix.toLowerCase().replace(/\s+/g, "-")}.jpg`,
        fileUrl: "/storage/menu-kamis.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 128,
        uploadedBy: uploader.id,
        status: "ready"
      }
    });
    state.created.fileId = file.id;

    const menu = await prisma.menu.create({
      data: {
        sppgId: sppg.id,
        menuDate: new Date(),
        menuName: "Menu Kamis",
        items: ["Nasi", "Ayam", "Sayur", "Buah"],
        photoFileId: file.id,
        manualPricePerPortion: 13000,
        calories: 660,
        proteinG: 20,
        carbsG: 70,
        fatG: 15,
        priceValidationStatus: "VERIFIED"
      }
    });
    state.created.menuId = menu.id;

    const response = await request(`/api/public/sppg/${sppg.id}`);

    assert.equal(response.status, 200);
    assert.equal(response.body?.status, "success");
    assert.equal(response.body?.data?.todayMenu?.name, "Menu Kamis");
    assert.deepEqual(response.body?.data?.todayMenu?.items, ["Nasi", "Ayam", "Sayur", "Buah"]);
    assert.equal(response.body?.data?.todayMenu?.photo?.url, "/storage/menu-kamis.jpg");
    assert.equal(response.body?.data?.todayMenu?.manualPricePerPortion, 13000);

    const keys = collectKeys(response.body.data);
    assert.equal(keys.some((key) => SENSITIVE_KEYS.has(key)), false);
  });

  it("validates public analytics query parameters", async () => {
    const response = await request("/api/public/statistics?granularity=yearly");

    assert.equal(response.status, 400);
  });
});
