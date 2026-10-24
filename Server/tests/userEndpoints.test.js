// Server/tests/userEndpoints.test.js
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import app from "../app.js";
import { User } from "../models/index.js";

describe("User Listing Endpoints Test Suite", () => {
  let server, base;
  let adminUser, adminToken;
  let librarianUser, librarianToken;
  let studentUser, studentToken;
  const suffix = Date.now();
  const jwtSecret = process.env.JWT_SECRET || "prestar_jwt_dev_secret_2026";

  before(async () => {
    // Start ephemeral server
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        base = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    // Create test users
    adminUser = await User.create({
      first_name: "Admin",
      last_name: `UserTest_${suffix}`,
      email: `admin_usertest_${suffix}@wmsu.edu.ph`,
      password_hash: "dummyhash123",
      role: "Admin",
      status: "Active",
      email_verified: true,
    });
    adminToken = jwt.sign(
      { id: adminUser.user_id, role: "Admin", email: adminUser.email },
      jwtSecret,
      { expiresIn: "1h" },
    );

    librarianUser = await User.create({
      first_name: "Librarian",
      last_name: `UserTest_${suffix}`,
      email: `lib_usertest_${suffix}@wmsu.edu.ph`,
      password_hash: "dummyhash123",
      role: "Librarian",
      status: "Active",
      email_verified: true,
    });
    librarianToken = jwt.sign(
      { id: librarianUser.user_id, role: "Librarian", email: librarianUser.email },
      jwtSecret,
      { expiresIn: "1h" },
    );

    studentUser = await User.create({
      first_name: "Student",
      last_name: `UserTest_${suffix}`,
      email: `student_usertest_${suffix}@wmsu.edu.ph`,
      password_hash: "dummyhash123",
      role: "Student",
      status: "Active",
      email_verified: true,
    });
    studentToken = jwt.sign(
      { id: studentUser.user_id, role: "Student", email: studentUser.email },
      jwtSecret,
      { expiresIn: "1h" },
    );
  });

  after(async () => {
    // Cleanup test users
    const ids = [adminUser, librarianUser, studentUser]
      .filter(Boolean)
      .map((u) => u.user_id);
    if (ids.length) {
      await User.destroy({ where: { user_id: ids } });
    }
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  async function get(path, token) {
    const res = await fetch(`${base}${path}`, {
      headers: { Cookie: `auth_token=${token}` },
    });
    const body = await res.json();
    return { status: res.status, body };
  }

  it("1. GET /api/users returns 403 for Student role", async () => {
    const { status } = await get("/api/users", studentToken);
    assert.equal(status, 403);
  });

  it("2. GET /api/users returns 200 for Admin with user list", async () => {
    const { status, body } = await get("/api/users", adminToken);
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.data), "data should be an array");
    assert.ok(Array.isArray(body.users), "users should be an array");
    assert.ok(body.data.length > 0, "should return at least one user");

    // Each user should have exactly name, status, role
    for (const user of body.data) {
      assert.ok(typeof user.name === "string" && user.name.length > 0, "name should be non-empty");
      assert.ok(typeof user.status === "string", "status should be a string");
      assert.ok(typeof user.role === "string", "role should be a string");
      assert.equal(Object.keys(user).length, 3, "each user object should have exactly 3 fields");
    }
  });

  it("3. GET /api/users returns 200 for Librarian", async () => {
    const { status, body } = await get("/api/users", librarianToken);
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.data));
  });

  it("4. GET /api/users?role=Student filters by role", async () => {
    const { status, body } = await get("/api/users?role=Student", adminToken);
    assert.equal(status, 200);
    for (const user of body.data) {
      assert.equal(user.role, "Student");
    }
  });

  it("5. GET /api/users?sort_by=status sorts by status first", async () => {
    const { status, body } = await get("/api/users?sort_by=status", adminToken);
    assert.equal(status, 200);
    assert.ok(body.data.length > 0);
  });

  it("6. GET /api/admin/users returns 200 for Admin", async () => {
    const { status, body } = await get("/api/admin/users", adminToken);
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
  });

  it("7. GET /api/admin/users returns 403 for Librarian", async () => {
    const { status } = await get("/api/admin/users", librarianToken);
    assert.equal(status, 403);
  });
});
