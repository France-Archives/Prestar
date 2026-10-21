// Server/tests/corStorageAndStaffManagement.test.js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcrypt";
import {
  AcademicTerm,
  Admin,
  Librarian,
  Notification,
  Student,
  StudentVerification,
  User,
  sequelize,
} from "../models/index.js";
import generateToken from "../utils/generateToken.js";
import { COR_STORAGE_DIR, resolveCorFilePath } from "../utils/fileStorage.js";
import app from "../app.js";

// Helper to make test HTTP requests against Express app
async function mockRequest(app, { method, url, headers = {}, body = null }) {
  const reqHeaders = { ...headers };
  let payloadStr = "";

  if (body && typeof body === "object" && !Buffer.isBuffer(body)) {
    payloadStr = JSON.stringify(body);
    reqHeaders["content-type"] = "application/json";
    reqHeaders["content-length"] = Buffer.byteLength(payloadStr);
  }

  return new Promise((resolve, reject) => {
    const http = app.handle ? app : app;
    const req = {
      method,
      url,
      headers: reqHeaders,
      body: body,
      query: {},
      params: {},
    };

    // We can use native node http server for robust end-to-end request test
    const server = app.listen(0, async () => {
      const port = server.address().port;
      try {
        const fetchOptions = {
          method,
          headers: reqHeaders,
        };
        if (body) {
          fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
        }
        const res = await fetch(`http://127.0.0.1:${port}${url}`, fetchOptions);
        const text = await res.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {}
        server.close();
        resolve({
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          text,
          json,
        });
      } catch (err) {
        server.close();
        reject(err);
      }
    });
  });
}

test("Private COR Storage, Notification Lifecycle, and Admin Staff Creation", async (t) => {
  const unique = Date.now();
  let adminUser, librarianUser, studentUser, activeTerm;
  let adminToken, librarianToken, studentToken;

  await t.test("Setup test fixtures (Admin, Librarian, Student, Active Term)", async () => {
    // Create active term
    [activeTerm] = await AcademicTerm.findOrCreate({
      where: { term_name: `AY 2026-2027 · Term ${unique}` },
      defaults: {
        start_date: "2026-08-01",
        end_date: "2026-12-31",
        cor_deadline: "2026-12-31",
        status: "Active",
      },
    });

    const passwordHash = await bcrypt.hash("Password123!", 10);

    // Admin
    adminUser = await User.create({
      first_name: "Admin",
      last_name: "Boss",
      email: `admin_${unique}@wmsu.edu.ph`,
      password_hash: passwordHash,
      role: "Admin",
      status: "Active",
      email_verified: true,
    });
    await Admin.create({ user_id: adminUser.user_id, employee_number: `ADM-${unique}` });
    adminToken = generateToken({ id: adminUser.user_id, role: "Admin" });

    // Librarian
    librarianUser = await User.create({
      first_name: "Lib",
      last_name: "Worker",
      email: `lib_${unique}@wmsu.edu.ph`,
      password_hash: passwordHash,
      role: "Librarian",
      status: "Active",
      email_verified: true,
    });
    await Librarian.create({ user_id: librarianUser.user_id, employee_number: `LIB-${unique}` });
    librarianToken = generateToken({ id: librarianUser.user_id, role: "Librarian" });

    // Student
    studentUser = await User.create({
      first_name: "Jane",
      last_name: "Doe",
      email: `student_${unique}@wmsu.edu.ph`,
      password_hash: passwordHash,
      role: "Student",
      status: "Active",
      email_verified: true,
    });
    await Student.create({
      user_id: studentUser.user_id,
      student_number: `SN-${unique}`,
      college: "CCS",
      course: "BSCS",
      year_level: 2,
    });
    studentToken = generateToken({ id: studentUser.user_id, role: "Student" });

    assert.ok(adminToken);
    assert.ok(librarianToken);
    assert.ok(studentToken);
  });

  let submittedVerificationId = null;
  let storedCorFilename = null;

  await t.test("Student submits COR via base64 camera photo to private file storage", async () => {
    // 1x1 transparent PNG data URI
    const dummyImageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const res = await mockRequest(app, {
      method: "POST",
      url: "/api/me/verifications",
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
      body: {
        image: dummyImageBase64,
        originalFileName: "camera_cor_test.png",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.json.status, "Pending");
    assert.ok(res.json.id);
    assert.ok(res.json.proofFile);

    submittedVerificationId = res.json.id;
    storedCorFilename = res.json.proofFile;

    // Verify file actually exists in private storage directory
    const resolvedPath = resolveCorFilePath(storedCorFilename);
    assert.ok(resolvedPath, "Private file path must exist");
    assert.ok(fs.existsSync(resolvedPath), "File must be physically written to Server/storage/cor/");

    // Verify submission notification was created for student
    const notifs = await Notification.findAll({
      where: { user_id: studentUser.user_id, type: "COR_SUBMITTED" },
    });
    assert.equal(notifs.length, 1);
    assert.equal(notifs[0].title, "COR submitted");
  });

  await t.test("Staff can view queue and stream private COR document; unauthorized users get 403", async () => {
    // 1. Staff queue includes the submitted COR and student details
    const queueRes = await mockRequest(app, {
      method: "GET",
      url: "/api/staff/verifications?status=Pending",
      headers: {
        Authorization: `Bearer ${librarianToken}`,
      },
    });
    assert.equal(queueRes.status, 200);
    const item = queueRes.json.find((v) => String(v.id) === String(submittedVerificationId));
    assert.ok(item, "Submitted verification must be in staff queue");
    assert.equal(item.student.studentNumber, `SN-${unique}`);

    // 2. Librarian can stream the document
    const docRes = await mockRequest(app, {
      method: "GET",
      url: `/api/staff/verifications/${submittedVerificationId}/document`,
      headers: {
        Authorization: `Bearer ${librarianToken}`,
      },
    });
    assert.equal(docRes.status, 200);
    assert.ok(docRes.headers["content-type"].includes("image/png"));

    // 3. Student owner can stream their own document
    const ownerRes = await mockRequest(app, {
      method: "GET",
      url: `/api/me/verifications/${submittedVerificationId}/document`,
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });
    assert.equal(ownerRes.status, 200);

    // 4. Another student cannot access someone else's private document
    const otherStudent = await User.create({
      first_name: "Intruder",
      last_name: "Spy",
      email: `other_${unique}@wmsu.edu.ph`,
      password_hash: "hash",
      role: "Student",
      status: "Active",
    });
    const otherToken = generateToken({ id: otherStudent.user_id, role: "Student" });

    const forbiddenRes = await mockRequest(app, {
      method: "GET",
      url: `/api/me/verifications/${submittedVerificationId}/document`,
      headers: {
        Authorization: `Bearer ${otherToken}`,
      },
    });
    assert.equal(forbiddenRes.status, 403);
  });

  await t.test("Rejecting COR requires reason, marks status Rejected, and sends notification", async () => {
    // 1. Empty reason is rejected
    const badRes = await mockRequest(app, {
      method: "POST",
      url: `/api/staff/verifications/${submittedVerificationId}/reject`,
      headers: {
        Authorization: `Bearer ${librarianToken}`,
      },
      body: { reason: "" },
    });
    assert.equal(badRes.status, 400);

    // 2. Valid rejection
    const rejectRes = await mockRequest(app, {
      method: "POST",
      url: `/api/staff/verifications/${submittedVerificationId}/reject`,
      headers: {
        Authorization: `Bearer ${librarianToken}`,
      },
      body: { reason: "Document is blurry and missing registrar seal." },
    });
    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.json.status, "Rejected");
    assert.equal(rejectRes.json.remarks, "Document is blurry and missing registrar seal.");

    // Verify rejection notification
    const rejNotif = await Notification.findOne({
      where: { user_id: studentUser.user_id, type: "COR_REJECTED" },
    });
    assert.ok(rejNotif);
    assert.ok(rejNotif.message.includes("blurry"));
  });

  await t.test("Approving COR updates status to Approved and sends COR_APPROVED notification", async () => {
    const approveRes = await mockRequest(app, {
      method: "POST",
      url: `/api/staff/verifications/${submittedVerificationId}/approve`,
      headers: {
        Authorization: `Bearer ${librarianToken}`,
      },
      body: { remarks: "Approved by library staff." },
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.json.status, "Approved");
    assert.ok(approveRes.json.validUntil);

    // Verify approval notification
    const appNotif = await Notification.findOne({
      where: { user_id: studentUser.user_id, type: "COR_APPROVED" },
    });
    assert.ok(appNotif);
    assert.ok(appNotif.message.includes("approved"));
  });

  await t.test("Notification routes: listing, unread count, mark as read", async () => {
    // 1. Get unread count
    const unreadRes = await mockRequest(app, {
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(unreadRes.status, 200);
    assert.ok(unreadRes.json.unreadCount >= 2);

    // 2. List notifications
    const listRes = await mockRequest(app, {
      method: "GET",
      url: "/api/notifications",
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(listRes.status, 200);
    assert.ok(listRes.json.items.length >= 2);
    const targetNotifId = listRes.json.items[0].id;

    // 3. Mark single notification as read
    const markRes = await mockRequest(app, {
      method: "POST",
      url: `/api/notifications/${targetNotifId}/read`,
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(markRes.status, 200);
    assert.ok(markRes.json.readAt);

    // 4. Mark all as read
    const allReadRes = await mockRequest(app, {
      method: "POST",
      url: "/api/notifications/read-all",
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(allReadRes.status, 200);

    const recheckRes = await mockRequest(app, {
      method: "GET",
      url: "/api/notifications/unread-count",
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(recheckRes.json.unreadCount, 0);
  });

  await t.test("Admin creation & Librarian creation routes (Admin-only access control)", async () => {
    // 1. Non-admin (Librarian) cannot create accounts
    const forbiddenRes = await mockRequest(app, {
      method: "POST",
      url: "/api/admin/librarians",
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: {
        email: `newlib_${unique}@wmsu.edu.ph`,
        password: "StrongPassword123!",
        firstName: "Test",
        lastName: "Lib",
      },
    });
    assert.equal(forbiddenRes.status, 403);

    // 2. Student cannot create accounts
    const studentForbidden = await mockRequest(app, {
      method: "POST",
      url: "/api/admin/admins",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        email: `newadmin_${unique}@wmsu.edu.ph`,
        password: "StrongPassword123!",
        firstName: "Fake",
        lastName: "Admin",
      },
    });
    assert.equal(studentForbidden.status, 403);

    // 3. Admin successfully creates a new Librarian
    const createLibRes = await mockRequest(app, {
      method: "POST",
      url: "/api/admin/librarians",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        email: `created_lib_${unique}@wmsu.edu.ph`,
        password: "SecureLibrarian123!",
        firstName: "Elena",
        lastName: "Rostova",
        employeeNumber: `EMP-${unique}`,
      },
    });
    assert.equal(createLibRes.status, 201);
    assert.equal(createLibRes.json.user.role, "Librarian");
    assert.equal(createLibRes.json.user.email, `created_lib_${unique}@wmsu.edu.ph`);
    assert.equal(createLibRes.json.user.employeeNumber, `EMP-${unique}`);

    // Verify DB records
    const createdUser = await User.unscoped().findOne({ where: { email: `created_lib_${unique}@wmsu.edu.ph` } });
    assert.ok(createdUser);
    assert.equal(createdUser.role, "Librarian");
    assert.equal(createdUser.email_verified, true);
    assert.ok(await bcrypt.compare("SecureLibrarian123!", createdUser.password_hash));

    const createdLib = await Librarian.findOne({ where: { user_id: createdUser.user_id } });
    assert.ok(createdLib);
    assert.equal(createdLib.employee_number, `EMP-${unique}`);

    // 4. Duplicate email is rejected with 409
    const dupRes = await mockRequest(app, {
      method: "POST",
      url: "/api/admin/librarians",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        email: `created_lib_${unique}@wmsu.edu.ph`,
        password: "SecureLibrarian123!",
        firstName: "Elena",
        lastName: "Rostova",
      },
    });
    assert.equal(dupRes.status, 409);

    // 5. Admin successfully creates a new Admin
    const createAdminRes = await mockRequest(app, {
      method: "POST",
      url: "/api/admin/admins",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        email: `created_adm_${unique}@wmsu.edu.ph`,
        password: "SecureAdminPass123!",
        firstName: "Victor",
        lastName: "Stone",
        employeeNumber: `ADM-EMP-${unique}`,
      },
    });
    assert.equal(createAdminRes.status, 201);
    assert.equal(createAdminRes.json.user.role, "Admin");
    assert.equal(createAdminRes.json.user.email, `created_adm_${unique}@wmsu.edu.ph`);

    const createdAdminRow = await Admin.findOne({
      where: { employee_number: `ADM-EMP-${unique}` },
    });
    assert.ok(createdAdminRow);
  });
});
