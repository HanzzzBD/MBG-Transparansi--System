process.env.NODE_ENV = process.env.NODE_ENV || "test";

const assert = require("node:assert/strict");
const http = require("node:http");
const { after, before, describe, it } = require("node:test");

const bcrypt = require("bcrypt");

const app = require("../src/app");
const { getPrismaClient } = require("../src/config/prisma");
const { BCRYPT_ROUNDS } = require("../src/utils/auth");

const prisma = getPrismaClient();

const state = {
  server: null,
  baseUrl: "",
  email: `reset-${Date.now()}@mbg.local`
};

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${state.baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => null);

  return {
    body: payload,
    status: response.status
  };
}

describe("password reset flow", () => {
  before(async () => {
    state.server = http.createServer(app);
    await new Promise((resolve) => {
      state.server.listen(0, "127.0.0.1", resolve);
    });
    state.baseUrl = `http://127.0.0.1:${state.server.address().port}`;

    await prisma.user.create({
      data: {
        name: "Password Reset Test Admin",
        email: state.email,
        password: await bcrypt.hash("OldPass123!", BCRYPT_ROUNDS),
        role: "admin"
      }
    });
  });

  after(async () => {
    await prisma.passwordResetToken.deleteMany({
      where: {
        user: {
          email: state.email
        }
      }
    });
    await prisma.user.deleteMany({
      where: {
        email: state.email
      }
    });
    await new Promise((resolve) => state.server.close(resolve));
  });

  it("returns a generic response and resets password with a valid token", async () => {
    const forgotResponse = await request("/api/auth/forgot-password", {
      method: "POST",
      body: {
        email: state.email
      }
    });

    assert.equal(forgotResponse.status, 200);
    assert.match(forgotResponse.body?.data?.message, /Jika email terdaftar/i);
    assert.ok(forgotResponse.body?.data?.resetToken);

    const resetResponse = await request("/api/auth/reset-password", {
      method: "POST",
      body: {
        token: forgotResponse.body.data.resetToken,
        password: "NewPass123!"
      }
    });

    assert.equal(resetResponse.status, 200);
    assert.match(resetResponse.body?.data?.message, /berhasil/i);

    const loginResponse = await request("/api/auth/login", {
      method: "POST",
      body: {
        email: state.email,
        password: "NewPass123!"
      }
    });

    assert.equal(loginResponse.status, 200);
    assert.equal(loginResponse.body?.data?.user?.email, state.email);
  });

  it("does not reveal whether an email exists", async () => {
    const response = await request("/api/auth/forgot-password", {
      method: "POST",
      body: {
        email: `missing-${Date.now()}@mbg.local`
      }
    });

    assert.equal(response.status, 200);
    assert.match(response.body?.data?.message, /Jika email terdaftar/i);
    assert.equal(response.body?.data?.resetToken, undefined);
  });

  it("rejects invalid reset tokens", async () => {
    const response = await request("/api/auth/reset-password", {
      method: "POST",
      body: {
        token: "invalid-token-that-is-long-enough-for-validation",
        password: "AnotherPass123!"
      }
    });

    assert.equal(response.status, 400);
    assert.equal(response.body?.code, "PASSWORD_RESET_TOKEN_INVALID");
  });
});
