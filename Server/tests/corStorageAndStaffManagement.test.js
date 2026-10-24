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

  if (body && typeof body === "object" && !(body instanceof FormData) && !Buffer.isBuffer(body)) {
    payloadStr = JSON.stringify(body);
    reqHeaders["content-type"] = "application/json";
    reqHeaders["content-length"] = Buffer.byteLength(payloadStr);
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      try {
        const fetchOptions = {
          method,
          headers: reqHeaders,
        };
        if (body) {
          fetchOptions.body = body instanceof FormData ? body : (typeof body === "string" ? body : JSON.stringify(body));
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

  await t.test("Empty verification submissions and client-sent string names are rejected with 400", async () => {
    // 1. Empty body
    const emptyRes = await mockRequest(app, {
      method: "POST",
      url: "/api/me/verifications",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {},
    });
    assert.equal(emptyRes.status, 400);

    // 2. Client-sent string name without file or valid data URL (the removed branch)
    const clientNameRes = await mockRequest(app, {
      method: "POST",
      url: "/api/me/verifications",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { proof_file: "client_chosen_name.jpg" },
    });
    assert.equal(clientNameRes.status, 400);

    // 3. String that is not a data:image/... or data:application/pdf
    const textDataRes = await mockRequest(app, {
      method: "POST",
      url: "/api/me/verifications",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { image: "data:text/plain;base64,aGVsbG8=" },
    });
    assert.equal(textDataRes.status, 400);
  });

  await t.test("Real file signature checks (JPEG, PNG, WebP, PDF) are enforced for base64 and multipart uploads", async () => {
    let studentSeq = 1;
    const makeStudent = async (label) => {
      const u = await User.create({
        first_name: "Student",
        last_name: label,
        email: `s_${studentSeq++}_${Date.now()}@wmsu.edu.ph`,
        password_hash: "hash",
        role: "Student",
        status: "Active",
        email_verified: true,
      });
      await Student.create({
        user_id: u.user_id,
        student_number: `S${Date.now() % 100000000}${studentSeq}`,
        college: "CCS",
        course: "BSCS",
        year_level: 1,
      });
      return {
        user: u,
        token: generateToken({ id: u.user_id, role: "Student" }),
      };
    };

    // 1. Base64 data URL declaring image/jpeg but content is plain text
    const fakeImageBase64 = `data:image/jpeg;base64,${Buffer.from("This is just fake plain text masquerading as JPEG").toString("base64")}`;
    const fakeRes = await mockRequest(app, {
      method: "POST",
      url: "/api/me/verifications",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { image: fakeImageBase64 },
    });
    assert.equal(fakeRes.status, 400);

    // 2. Base64 data URL with PDF (%PDF) is rejected because only realtime captured images are allowed
    const validPdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
    const validPdfBase64 = `data:application/pdf;base64,${validPdfBuffer.toString("base64")}`;
    const pdfRes = await mockRequest(app, {
      method: "POST",
      url: "/api/me/verifications",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { file: validPdfBase64, originalFileName: "my_cor.pdf" },
    });
    assert.equal(pdfRes.status, 400, "PDF submissions must be rejected since only realtime captured images are accepted");

    // 3. Base64 declaring image/png but payload is actually JPEG magic bytes (FF D8 FF)
    const st1 = await makeStudent("png_as_jpg");
    const realJpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01]);
    const declaredPngActualJpeg = `data:image/png;base64,${realJpegBytes.toString("base64")}`;
    const detectRes = await mockRequest(app, {
      method: "POST",
      url: "/api/me/verifications",
      headers: { Authorization: `Bearer ${st1.token}` },
      body: { image: declaredPngActualJpeg },
    });
    assert.equal(detectRes.status, 201);
    assert.ok(detectRes.json.proofFile.endsWith(".jpg"), "Must detect real JPEG signature instead of trusting declared PNG");

    // 4. Multipart upload with fake JPEG content (plain text) is rejected
    const fakeMultipartForm = new FormData();
    fakeMultipartForm.append("file", new Blob(["NOT AN IMAGE CONTENT"], { type: "image/jpeg" }), "fake.jpg");
    const multipartFakeRes = await mockRequest(app, {
      method: "POST",
      url: "/api/me/verifications",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: fakeMultipartForm,
    });
    assert.equal(multipartFakeRes.status, 400);

    // 5. Multipart upload with PDF content is rejected
    const invalidPdfForm = new FormData();
    invalidPdfForm.append("file", new Blob([validPdfBuffer], { type: "application/pdf" }), "document.pdf");
    const multipartPdfRes = await mockRequest(app, {
      method: "POST",
      url: "/api/me/verifications",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: invalidPdfForm,
    });
    assert.equal(multipartPdfRes.status, 400, "Multipart PDF upload must be rejected");

    // 6. Multipart upload with valid captured JPEG image passes
    const st2 = await makeStudent("jpg_multipart");
    const validJpegForm = new FormData();
    validJpegForm.append("file", new Blob([realJpegBytes], { type: "image/jpeg" }), "captured_photo.jpg");
    const multipartValidRes = await mockRequest(app, {
      method: "POST",
      url: "/api/me/verifications",
      headers: { Authorization: `Bearer ${st2.token}` },
      body: validJpegForm,
    });
    assert.equal(multipartValidRes.status, 201);
    assert.ok(multipartValidRes.json.proofFile.endsWith(".jpg"));
  });

  await t.test("Details endpoints: GET /me/verifications/:id (owner only) and GET /staff/verifications/:id (Librarian/Admin)", async () => {
    // 1. GET /me/verifications list to compare shape
    const myListRes = await mockRequest(app, {
      method: "GET",
      url: "/api/me/verifications",
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(myListRes.status, 200);
    assert.ok(Array.isArray(myListRes.json));
    const targetItem = myListRes.json.find((v) => String(v.id) === String(submittedVerificationId));
    assert.ok(targetItem);

    // 2. GET /me/verifications/:id (owner access) returns the same shape as list
    const myDetailRes = await mockRequest(app, {
      method: "GET",
      url: `/api/me/verifications/${submittedVerificationId}`,
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(myDetailRes.status, 200);
    assert.deepEqual(myDetailRes.json, targetItem, "Details endpoint must return the exact same shape as the list item");

    // 3. GET /me/verifications/:id by another student (unauthorized) returns 403
    const otherStudent = await User.create({
      first_name: "Intruder2",
      last_name: "Spy2",
      email: `other2_${unique}@wmsu.edu.ph`,
      password_hash: "hash",
      role: "Student",
      status: "Active",
    });
    const otherToken = generateToken({ id: otherStudent.user_id, role: "Student" });

    const forbiddenMeRes = await mockRequest(app, {
      method: "GET",
      url: `/api/me/verifications/${submittedVerificationId}`,
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    assert.equal(forbiddenMeRes.status, 403);

    // 4. GET /me/verifications/:id with non-existent ID returns 404
    const notFoundMeRes = await mockRequest(app, {
      method: "GET",
      url: "/api/me/verifications/999999",
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(notFoundMeRes.status, 404);

    // 5. GET /staff/verifications list to compare shape
    const staffQueueRes = await mockRequest(app, {
      method: "GET",
      url: "/api/staff/verifications",
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    assert.equal(staffQueueRes.status, 200);
    const queueTarget = staffQueueRes.json.find((v) => String(v.id) === String(submittedVerificationId));
    assert.ok(queueTarget);

    // 6. GET /staff/verifications/:id by Librarian returns same shape as queue list
    const staffDetailRes = await mockRequest(app, {
      method: "GET",
      url: `/api/staff/verifications/${submittedVerificationId}`,
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    assert.equal(staffDetailRes.status, 200);
    assert.deepEqual(staffDetailRes.json, queueTarget, "Staff details endpoint must return the exact same shape as staff queue list");

    // 7. GET /staff/verifications/:id by Admin returns 200
    const adminDetailRes = await mockRequest(app, {
      method: "GET",
      url: `/api/staff/verifications/${submittedVerificationId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminDetailRes.status, 200);
    assert.deepEqual(adminDetailRes.json, queueTarget);

    // 8. GET /staff/verifications/:id by Student returns 403
    const studentStaffForbidden = await mockRequest(app, {
      method: "GET",
      url: `/api/staff/verifications/${submittedVerificationId}`,
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(studentStaffForbidden.status, 403);

    // 9. GET /staff/verifications/:id with non-existent ID returns 404
    const staffNotFoundRes = await mockRequest(app, {
      method: "GET",
      url: "/api/staff/verifications/999999",
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    assert.equal(staffNotFoundRes.status, 404);
  });

  await t.test("Staff/Admin/Librarian COR endpoints: search filtering, route aliases, approve and reject", async () => {
    // 1. Create a fresh student and verification submission for this test
    const customUser = await User.create({
      first_name: "Hermione",
      last_name: "Granger",
      email: `hermione_${Date.now()}@wmsu.edu.ph`,
      password_hash: "hash",
      role: "Student",
      status: "Active",
      email_verified: true,
    });
    await Student.create({
      user_id: customUser.user_id,
      student_number: `H${Date.now() % 100000000}`,
      college: "College of Science",
      course: "BS Computer Science",
      year_level: 2,
    });
    const customStudentToken = generateToken({ id: customUser.user_id, role: "Student" });
    const realPngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const submitRes = await mockRequest(app, {
      method: "POST",
      url: "/api/me/verifications",
      headers: { Authorization: `Bearer ${customStudentToken}` },
      body: {
        image: realPngDataUrl,
        originalFileName: "hermione_cor.png",
      },
    });
    assert.equal(submitRes.status, 201);
    const verifId = submitRes.json.id;

    // 2. Listing queue with ?search= matching student name
    const searchRes = await mockRequest(app, {
      method: "GET",
      url: "/api/staff/verifications?search=Hermione",
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    assert.equal(searchRes.status, 200);
    assert.ok(searchRes.json.some((v) => String(v.id) === String(verifId)));

    // 3. Search non-matching returns empty or doesn't include this record
    const searchNoMatchRes = await mockRequest(app, {
      method: "GET",
      url: "/api/staff/verifications?search=NonExistentStudentQueryXYZ",
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    assert.equal(searchNoMatchRes.status, 200);
    assert.ok(!searchNoMatchRes.json.some((v) => String(v.id) === String(verifId)));

    // 4. Status filter with case-insensitivity: ?status=pending and ?status=ALL
    const statusPendingRes = await mockRequest(app, {
      method: "GET",
      url: "/api/staff/verifications?status=pending",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(statusPendingRes.status, 200);
    assert.ok(statusPendingRes.json.some((v) => String(v.id) === String(verifId)));

    const statusAllRes = await mockRequest(app, {
      method: "GET",
      url: "/api/staff/verifications?status=ALL",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(statusAllRes.status, 200);
    assert.ok(statusAllRes.json.some((v) => String(v.id) === String(verifId)));

    // 5. Route aliases for queue listing: /api/admin/verifications, /api/librarian/verifications, /api/verifications
    const adminQueueRes = await mockRequest(app, {
      method: "GET",
      url: "/api/admin/verifications",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminQueueRes.status, 200);
    assert.ok(adminQueueRes.json.some((v) => String(v.id) === String(verifId)));

    const librarianQueueRes = await mockRequest(app, {
      method: "GET",
      url: "/api/librarian/verifications",
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    assert.equal(librarianQueueRes.status, 200);

    const genericVerifQueueRes = await mockRequest(app, {
      method: "GET",
      url: "/api/verifications",
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    assert.equal(genericVerifQueueRes.status, 200);

    // 6. Route aliases for getting a specific COR: /api/admin/verifications/:id, /api/librarian/verifications/:id
    const adminGetOne = await mockRequest(app, {
      method: "GET",
      url: `/api/admin/verifications/${verifId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminGetOne.status, 200);
    assert.equal(adminGetOne.json.student.name, "Hermione Granger");
    assert.equal(adminGetOne.json.student.course, "BS Computer Science");

    const librarianGetOne = await mockRequest(app, {
      method: "GET",
      url: `/api/librarian/verifications/${verifId}`,
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    assert.equal(librarianGetOne.status, 200);
    assert.equal(librarianGetOne.json.student.name, "Hermione Granger");

    // 7. Rejecting specific COR via /api/admin/verifications/:id/reject
    const rejectBadRes = await mockRequest(app, {
      method: "POST",
      url: `/api/admin/verifications/${verifId}/reject`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { reason: "   " },
    });
    assert.equal(rejectBadRes.status, 400);

    const rejectNotFound = await mockRequest(app, {
      method: "POST",
      url: "/api/admin/verifications/999999/reject",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { reason: "Record missing" },
    });
    assert.equal(rejectNotFound.status, 404);

    const rejectAliasRes = await mockRequest(app, {
      method: "POST",
      url: `/api/admin/verifications/${verifId}/reject`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { reason: "Document watermark obscured." },
    });
    assert.equal(rejectAliasRes.status, 200);
    assert.equal(rejectAliasRes.json.status, "Rejected");
    assert.equal(rejectAliasRes.json.remarks, "Document watermark obscured.");
    assert.equal(rejectAliasRes.json.rejectionReason, "Document watermark obscured.");
    assert.ok(rejectAliasRes.json.student);
    assert.equal(rejectAliasRes.json.reviewer.role, "Admin");

    // 8. Approving specific COR via /api/librarian/verifications/:id/approve
    const approveNotFound = await mockRequest(app, {
      method: "POST",
      url: "/api/librarian/verifications/999999/approve",
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    assert.equal(approveNotFound.status, 404);

    const approveAliasRes = await mockRequest(app, {
      method: "POST",
      url: `/api/librarian/verifications/${verifId}/approve`,
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: { remarks: "Approved after re-checking seal." },
    });
    assert.equal(approveAliasRes.status, 200);
    assert.equal(approveAliasRes.json.status, "Approved");
    assert.ok(approveAliasRes.json.validUntil);
    assert.equal(approveAliasRes.json.remarks, "Approved after re-checking seal.");
    assert.ok(approveAliasRes.json.student);
    assert.equal(approveAliasRes.json.reviewer.role, "Librarian");
  });
});
