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
  baseUrl: ""
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

  it("validates public analytics query parameters", async () => {
    const response = await request("/api/public/statistics?granularity=yearly");

    assert.equal(response.status, 400);
  });
});
