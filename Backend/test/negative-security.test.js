process.env.NODE_ENV = process.env.NODE_ENV || "test";

const assert = require("node:assert/strict");
const http = require("node:http");
const { after, before, describe, it } = require("node:test");

const bcrypt = require("bcrypt");

const app = require("../src/app");
const { getPrismaClient } = require("../src/config/prisma");
const { getRedisClient } = require("../src/config/redis");
const { storageConfig } = require("../src/config/storage");
const { deleteStoredObject } = require("../src/utils/storage");
const { BCRYPT_ROUNDS, signAccessToken } = require("../src/utils/auth");

const prisma = getPrismaClient();

const state = {
  prefix: `negative_security_${Date.now()}`,
  server: null,
  baseUrl: "",
  sppg: {},
  schools: {},
  distributions: {},
  users: {},
  uploadedFiles: [],
  tokens: {}
};

async function request(path, { method = "GET", token, body, formData } = {}) {
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
    body: formData || (body === undefined ? undefined : JSON.stringify(body))
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
    status: response.status
  };
}

function tokenFor(user) {
  return signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
    sppgId: user.sppgId,
    schoolId: user.schoolId
  });
}

async function allowPermission(user, permissionKey) {
  const permission = await prisma.permission.upsert({
    where: {
      key: permissionKey
    },
    update: {},
    create: {
      key: permissionKey,
      name: permissionKey,
      group: "security_test"
    }
  });

  await prisma.userPermission.upsert({
    where: {
      userId_permissionId: {
        userId: user.id,
        permissionId: permission.id
      }
    },
    update: {
      effect: "ALLOW"
    },
    create: {
      userId: user.id,
      permissionId: permission.id,
      effect: "ALLOW",
      reason: "Negative security test fixture"
    }
  });
}

function makeUploadForm({ content, type, filename }) {
  const form = new FormData();
  form.append("file", new Blob([content], { type }), filename);
  return form;
}

function collectStrings(value, strings = []) {
  if (typeof value === "string") {
    strings.push(value);
    return strings;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, strings));
    return strings;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, strings));
  }

  return strings;
}

async function setupData() {
  const password = await bcrypt.hash("TestPass123!", BCRYPT_ROUNDS);

  state.sppg.a = await prisma.sppg.create({
    data: {
      name: `${state.prefix} SPPG Alpha`,
      province: "Jawa Barat",
      city: "Bandung",
      capacity: 500,
      status: "active"
    }
  });

  state.sppg.b = await prisma.sppg.create({
    data: {
      name: `${state.prefix} SPPG Beta`,
      province: "Jawa Timur",
      city: "Surabaya",
      capacity: 500,
      status: "active"
    }
  });

  state.users.admin = await prisma.user.create({
    data: {
      name: `${state.prefix} Admin`,
      email: `${state.prefix}.admin@example.test`,
      password,
      role: "admin"
    }
  });

  state.users.sppgA = await prisma.user.create({
    data: {
      name: `${state.prefix} SPPG A`,
      email: `${state.prefix}.sppg.a@example.test`,
      password,
      role: "sppg",
      sppgId: state.sppg.a.id
    }
  });

  state.schools.a = await prisma.school.create({
    data: {
      name: `${state.prefix} School Alpha`,
      province: "Jawa Barat",
      city: "Bandung",
      sppgId: state.sppg.a.id,
      totalStudents: 180,
      npsn: `${state.prefix}_school_a`
    }
  });

  state.distributions.a = await prisma.distribution.create({
    data: {
      sppgId: state.sppg.a.id,
      schoolId: state.schools.a.id,
      portions: 180,
      pricePerPortion: "13000.00",
      distributionDate: new Date("2026-05-28T00:00:00.000Z"),
      status: "delivered"
    }
  });

  state.users.schoolA = await prisma.user.create({
    data: {
      name: `${state.prefix} School User`,
      email: `${state.prefix}.school.a@example.test`,
      password,
      role: "sekolah",
      schoolId: state.schools.a.id
    }
  });

  await allowPermission(state.users.sppgA, "issue.create");
  await allowPermission(state.users.sppgA, "issue.view");

  state.tokens = {
    admin: tokenFor(state.users.admin),
    sppgA: tokenFor(state.users.sppgA),
    schoolA: tokenFor(state.users.schoolA)
  };
}

async function cleanupData() {
  const userIds = Object.values(state.users).map((user) => user?.id).filter(Boolean);
  const sppgIds = Object.values(state.sppg).map((sppg) => sppg?.id).filter(Boolean);
  const schoolIds = Object.values(state.schools).map((school) => school?.id).filter(Boolean);
  const distributionIds = Object.values(state.distributions).map((distribution) => distribution?.id).filter(Boolean);
  const fileIds = state.uploadedFiles.map((file) => file?.id).filter(Boolean);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds.length ? userIds : [-1] } },
        { tableName: "issues", newData: { path: ["description"], string_contains: state.prefix } },
        { tableName: "files", recordId: { in: fileIds.length ? fileIds : [-1] } },
        { tableName: "proofs", recordId: { in: fileIds.length ? fileIds : [-1] } }
      ]
    }
  });
  await prisma.proof.deleteMany({
    where: {
      OR: [
        { fileId: { in: fileIds.length ? fileIds : [-1] } },
        { distributionId: { in: distributionIds.length ? distributionIds : [-1] } }
      ]
    }
  });
  await prisma.issue.deleteMany({
    where: {
      OR: [
        { reportedBy: { in: userIds.length ? userIds : [-1] } },
        { sppgId: { in: sppgIds.length ? sppgIds : [-1] } }
      ]
    }
  });
  await prisma.userPermission.deleteMany({
    where: {
      userId: {
        in: userIds.length ? userIds : [-1]
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
  await prisma.loginAttempt.deleteMany({
    where: {
      email: {
        startsWith: state.prefix
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

  await Promise.all(
    state.uploadedFiles
      .map((file) => file?.storedName)
      .filter(Boolean)
      .map((storedName) => deleteStoredObject(storedName).catch(() => {}))
  );
}

describe("negative security tests", () => {
  before(async () => {
    await setupData();

    state.server = http.createServer(app);
    await new Promise((resolve) => {
      state.server.listen(0, "127.0.0.1", resolve);
    });
    state.baseUrl = `http://127.0.0.1:${state.server.address().port}`;
  });

  it("uses local storage only for uploads", () => {
    assert.equal(storageConfig.provider, "local");
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

  it("rejects unsupported upload MIME types without creating file rows", async () => {
    const beforeCount = await prisma.file.count({
      where: {
        uploadedBy: state.users.admin.id
      }
    });

    const response = await request("/api/files/upload", {
      method: "POST",
      token: state.tokens.admin,
      formData: makeUploadForm({
        content: "<script>alert(1)</script>",
        type: "text/html",
        filename: "payload.html"
      })
    });

    const afterCount = await prisma.file.count({
      where: {
        uploadedBy: state.users.admin.id
      }
    });

    assert.equal(response.status, 400);
    assert.equal(response.body?.code, "FILE_TYPE_NOT_ALLOWED");
    assert.equal(afterCount, beforeCount);
  });

  it("rejects spoofed image uploads whose content signature does not match the MIME type", async () => {
    const beforeCount = await prisma.file.count({
      where: {
        uploadedBy: state.users.admin.id
      }
    });

    const response = await request("/api/files/upload", {
      method: "POST",
      token: state.tokens.admin,
      formData: makeUploadForm({
        content: "<svg><script>alert(1)</script></svg>",
        type: "image/png",
        filename: "spoofed.png"
      })
    });

    const afterCount = await prisma.file.count({
      where: {
        uploadedBy: state.users.admin.id
      }
    });

    assert.equal(response.status, 400);
    assert.equal(response.body?.code, "FILE_CONTENT_NOT_ALLOWED");
    assert.equal(afterCount, beforeCount);
    assert.equal(collectStrings(response.body).some((text) => /at\s+\w+|Prisma|stack/i.test(text)), false);
  });

  it("rejects oversized image uploads before creating file rows", async () => {
    const beforeCount = await prisma.file.count({
      where: {
        uploadedBy: state.users.admin.id
      }
    });

    const oversizedPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(5 * 1024 * 1024 + 1)
    ]);
    const response = await request("/api/files/upload", {
      method: "POST",
      token: state.tokens.admin,
      formData: makeUploadForm({
        content: oversizedPng,
        type: "image/png",
        filename: "oversized.png"
      })
    });

    const afterCount = await prisma.file.count({
      where: {
        uploadedBy: state.users.admin.id
      }
    });

    assert.equal(response.status, 400);
    assert.equal(response.body?.code, "FILE_TOO_LARGE");
    assert.equal(afterCount, beforeCount);
  });

  it("lets a school upload and attach a local proof photo for its own distribution", async () => {
    const pngBytes = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("local-proof-photo")
    ]);

    const uploadResponse = await request("/api/files/upload", {
      method: "POST",
      token: state.tokens.schoolA,
      formData: makeUploadForm({
        content: pngBytes,
        type: "image/png",
        filename: "proof.png"
      })
    });

    assert.equal(uploadResponse.status, 201);
    assert.equal(uploadResponse.body?.status, "success");
    assert.equal(uploadResponse.body?.data?.mimeType, "image/png");
    assert.match(uploadResponse.body?.data?.fileUrl, /^\/storage\/uploads\/.+\.png$/);
    state.uploadedFiles.push(uploadResponse.body.data);

    const proofResponse = await request("/api/proofs", {
      method: "POST",
      token: state.tokens.schoolA,
      body: {
        distributionId: state.distributions.a.id,
        fileId: uploadResponse.body.data.id
      }
    });

    assert.equal(proofResponse.status, 201);
    assert.equal(proofResponse.body?.status, "success");
    assert.equal(proofResponse.body?.data?.distributionId, state.distributions.a.id);
    assert.equal(proofResponse.body?.data?.fileId, uploadResponse.body.data.id);
  });

  it("keeps proof attachment scoped to an existing distribution", async () => {
    const pngBytes = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("forbidden-proof-photo")
    ]);

    const uploadResponse = await request("/api/files/upload", {
      method: "POST",
      token: state.tokens.schoolA,
      formData: makeUploadForm({
        content: pngBytes,
        type: "image/png",
        filename: "forbidden-proof.png"
      })
    });
    state.uploadedFiles.push(uploadResponse.body.data);

    const forbiddenResponse = await request("/api/proofs", {
      method: "POST",
      token: state.tokens.schoolA,
      body: {
        distributionId: 999999999,
        fileId: uploadResponse.body.data.id
      }
    });

    assert.equal(uploadResponse.status, 201);
    assert.equal(forbiddenResponse.status, 404);
    assert.equal(forbiddenResponse.body?.code, "DISTRIBUTION_NOT_FOUND");
  });


  it("sanitizes stored text input so XSS payloads are not returned as executable markup", async () => {
    const payload = `${state.prefix} <script>alert("xss")</script> kekurangan bahan <img src=x onerror=alert(1)>`;
    const response = await request("/api/issues", {
      method: "POST",
      token: state.tokens.sppgA,
      body: {
        category: "kekurangan_bahan",
        description: payload
      }
    });

    assert.equal(response.status, 201);
    assert.equal(response.body?.status, "success");
    assert.match(response.body?.data?.description, new RegExp(state.prefix));
    assert.doesNotMatch(response.body?.data?.description, /<script|onerror|<img/i);
  });

  it("keeps search injection payloads scoped and controlled", async () => {
    const adminResponse = await request(`/api/search?q=${encodeURIComponent("' OR 1=1 --")}&limit=10`, {
      token: state.tokens.admin
    });
    const sppgResponse = await request(
      `/api/search?q=${encodeURIComponent(`${state.prefix} Beta ' OR 1=1 --`)}&limit=10`,
      {
        token: state.tokens.sppgA
      }
    );

    assert.equal(adminResponse.status, 200);
    assert.equal(sppgResponse.status, 200);
    assert.equal(collectStrings(adminResponse.body).some((text) => /Prisma|syntax error|stack/i.test(text)), false);
    assert.equal(
      collectStrings(sppgResponse.body).some((text) => text.includes(`${state.prefix} SPPG Beta`)),
      false
    );
  });
});
