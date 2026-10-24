// Server/tests/renewalEndpoints.test.js
import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import app from "../app.js";
import { User, Student, sequelize } from "../models/index.js";

describe("Renewal Endpoints Test Suite", () => {
  let server;
  let baseUrl;
  let studentUser;
  let studentToken;
  let staffUser;
  let staffToken;
  let uniqueSuffix;

  before(async () => {
    uniqueSuffix = Date.now();
    const jwtSecret = process.env.JWT_SECRET || "prestar_jwt_dev_secret_2026";

    // Start ephemeral server
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // 1. Create Student
    studentUser = await User.create({
      first_name: "Renewal",
      last_name: `Student_${uniqueSuffix}`,
      email: `renewal_student_${uniqueSuffix}@wmsu.edu.ph`,
      password_hash: "hash123",
      role: "Student",
      status: "Active",
      email_verified: true,
    });
    await Student.create({
      user_id: studentUser.user_id,
      student_number: `RN-${String(uniqueSuffix).slice(-6)}`,
      college: "CS",
      program: "BSCS",
      year_level: 3,
    });
    studentToken = jwt.sign(
      { id: studentUser.user_id, role: "Student", email: studentUser.email },
      jwtSecret,
      { expiresIn: "1h" },
    );

    // 2. Create Staff (Librarian)
    staffUser = await User.create({
      first_name: "Renewal",
      last_name: `Librarian_${uniqueSuffix}`,
      email: `renewal_lib_${uniqueSuffix}@prestar.edu`,
      password_hash: "hash123",
      role: "Librarian",
      status: "Active",
      email_verified: true,
    });
    staffToken = jwt.sign(
      { id: staffUser.user_id, role: "Librarian", email: staffUser.email },
      jwtSecret,
      { expiresIn: "1h" },
    );
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      if (studentUser) {
        await Student.destroy({ where: { user_id: studentUser.user_id } });
        await User.destroy({ where: { user_id: studentUser.user_id } });
      }
      if (staffUser) {
        await User.destroy({ where: { user_id: staffUser.user_id } });
      }
    } catch (err) {
      console.warn("Cleanup warning:", err.message);
    }
  });

  it("1. GET /api/renewals/mine returns 200 OK without 500 error", async () => {
    const res = await fetch(`${baseUrl}/api/renewals/mine`, {
      headers: { Cookie: `auth_token=${studentToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.data));
  });

  it("2. GET /api/renewals (Staff) returns 200 OK without 500 error", async () => {
    const res = await fetch(`${baseUrl}/api/renewals`, {
      headers: { Cookie: `auth_token=${staffToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.data));
  });

  it("3. GET /api/renewals/loan/999999 returns 404 for non-existent loan (no 500 crash)", async () => {
    const res = await fetch(`${baseUrl}/api/renewals/loan/999999`, {
      headers: { Cookie: `auth_token=${studentToken}` },
    });
    assert.strictEqual(res.status, 404);
  });

  it("4. POST /api/renewals/loan/999999 returns 404 or validation error (no 500 crash)", async () => {
    const res = await fetch(`${baseUrl}/api/renewals/loan/999999`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `auth_token=${studentToken}`,
      },
      body: JSON.stringify({ requestedDurationDays: 7 }),
    });
    assert.notStrictEqual(res.status, 500);
    assert.strictEqual(res.status, 404);
  });

  it("5. POST /api/borrowed-books/999999/renew returns 404 or validation error (no 500 crash)", async () => {
    const res = await fetch(`${baseUrl}/api/borrowed-books/999999/renew`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `auth_token=${studentToken}`,
      },
      body: JSON.stringify({ requestedDurationDays: 7 }),
    });
    assert.notStrictEqual(res.status, 500);
    assert.strictEqual(res.status, 404);
  });
});
