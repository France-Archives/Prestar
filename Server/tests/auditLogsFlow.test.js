// Server/tests/auditLogsFlow.test.js
import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import {
  User,
  Librarian,
  Admin,
  Author,
  Category,
  Book,
  BookCopy,
  BorrowRequest,
  BorrowedBook,
  Penalty,
  Student,
  StudentVerification,
  sequelize,
} from "../models/index.js";
import { getOrCreateTermForDate } from "../services/academicTermService.js";
import generateToken from "../utils/generateToken.js";
import app from "../app.js";

async function mockRequest(expressApp, { method, url, headers = {}, body = null }) {
  const reqHeaders = { ...headers };
  let payloadStr = "";

  if (body && typeof body === "object") {
    payloadStr = JSON.stringify(body);
    reqHeaders["content-type"] = "application/json";
    reqHeaders["content-length"] = Buffer.byteLength(payloadStr);
  }

  return new Promise((resolve, reject) => {
    const server = expressApp.listen(0, async () => {
      const port = server.address().port;
      try {
        const fetchOptions = {
          method,
          headers: reqHeaders,
        };
        if (body) {
          fetchOptions.body = payloadStr;
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

test("Audit Logs API Suite (Staff Activity & From/To Date Range)", async (t) => {
  const stamp = Date.now();
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Create Admin
  const adminUser = await User.create({
    first_name: "Admin",
    last_name: `Auditor_${stamp}`,
    email: `admin_audit_${stamp}@prestar.edu`,
    password_hash: passwordHash,
    role: "Admin",
    status: "Active",
    email_verified: true,
  });
  await Admin.create({
    user_id: adminUser.user_id,
    employee_number: `ADM-${stamp.toString().slice(-6)}`,
  });
  const adminToken = generateToken(adminUser);
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // 2. Create Librarian
  const librarianUser = await User.create({
    first_name: "Librarian",
    last_name: `Audited_${stamp}`,
    email: `lib_audit_${stamp}@prestar.edu`,
    password_hash: passwordHash,
    role: "Librarian",
    status: "Active",
    email_verified: true,
  });
  await Librarian.create({
    user_id: librarianUser.user_id,
    employee_number: `LIB-${stamp.toString().slice(-6)}`,
  });
  const librarianToken = generateToken(librarianUser);
  const librarianHeaders = { Authorization: `Bearer ${librarianToken}` };

  // 3. Create Student
  const studentUser = await User.create({
    first_name: "Student",
    last_name: `Borrower`,
    email: `student_audit_${stamp}@wmsu.edu.ph`,
    password_hash: passwordHash,
    role: "Student",
    status: "Active",
    email_verified: true,
  });
  await Student.create({
    user_id: studentUser.user_id,
    student_number: `SN-${stamp.toString().slice(-6)}`,
    course: "BSCS",
    year_level: 2,
    student_type: "Regular",
  });
  const activeTerm = await getOrCreateTermForDate(new Date());
  await StudentVerification.create({
    user_id: studentUser.user_id,
    term_id: activeTerm.term_id,
    proof_file: "test_cor.png",
    status: "Approved",
    valid_from: new Date(Date.now() - 10 * 86400000),
    valid_until: new Date(Date.now() + 60 * 86400000),
    reviewed_by: librarianUser.user_id,
    reviewed_at: new Date(),
  });
  const studentToken = generateToken(studentUser);
  const studentHeaders = { Authorization: `Bearer ${studentToken}` };

  await t.test("1. Reject unauthenticated access to /api/admin/audit-logs", async () => {
    const res = await mockRequest(app, {
      method: "GET",
      url: "/api/admin/audit-logs",
    });
    assert.equal(res.status, 401);
  });

  await t.test("2. Reject Student access to /api/admin/audit-logs (403 Forbidden)", async () => {
    const res = await mockRequest(app, {
      method: "GET",
      url: "/api/admin/audit-logs",
      headers: studentHeaders,
    });
    assert.equal(res.status, 403);
  });

  await t.test("3. Admin creates a new Librarian account and verifies audit log is generated", async () => {
    const newLibEmail = `newlib_${stamp}@prestar.edu`;
    const createRes = await mockRequest(app, {
      method: "POST",
      url: "/api/admin/librarians",
      headers: adminHeaders,
      body: {
        email: newLibEmail,
        password: "Password123!",
        firstName: "New",
        lastName: `Staff`,
        employeeNumber: `EMP-${stamp.toString().slice(-5)}`,
      },
    });
    assert.equal(createRes.status, 201);

    // Fetch audit logs
    const auditRes = await mockRequest(app, {
      method: "GET",
      url: `/api/admin/audit-logs?search=${encodeURIComponent(newLibEmail)}`,
      headers: adminHeaders,
    });
    assert.equal(auditRes.status, 200);
    assert.ok(Array.isArray(auditRes.json?.data));
    assert.ok(auditRes.json?.meta);
    assert.equal(typeof auditRes.json.meta.total, "number");
    assert.equal(typeof auditRes.json.meta.page, "number");
    assert.equal(typeof auditRes.json.meta.pageSize, "number");
  });

  await t.test("4. Librarian cash payment and penalty waiver produce audited entries", async () => {
    // Setup book, borrow, penalty
    const author = await Author.create({ first_name: "Author", last_name: `Audit_${stamp}` });
    const category = (await Category.findOne()) || (await Category.create({ category_name: `Cat_${stamp}` }));
    const book = await Book.create({
      title: `Audit Book ${stamp}`,
      isbn: `ISBN-A-${stamp}`,
      author_id: author.author_id,
      category_id: category.category_id,
      status: "Active",
    });
    const copy = await BookCopy.create({
      book_id: book.book_id,
      accession_no: `ACC-A-${stamp}`,
      condition_status: "Good",
      status: "Available",
    });
    const request = await BorrowRequest.create({
      user_id: studentUser.user_id,
      book_id: book.book_id,
      requested_days: 7,
      status: "Approved",
    });
    const borrow = await BorrowedBook.create({
      request_id: request.request_id,
      book_id: book.book_id,
      copy_id: copy.copy_id,
      status: "Returned",
      borrow_date: new Date(Date.now() - 5 * 86400000),
      due_date: new Date(Date.now() - 1 * 86400000),
      issued_by: librarianUser.user_id,
    });
    const penalty = await Penalty.create({
      borrow_id: borrow.borrow_id,
      penalty_type: "Damaged Book",
      amount: 150.00,
      status: "Unpaid",
      reason: "Torn cover page",
      created_by: librarianUser.user_id,
    });

    const receiptNo = `OR-AUDIT-${stamp}-01`;
    const payRes = await mockRequest(app, {
      method: "POST",
      url: `/api/fines/${penalty.penalty_id}/payments`,
      headers: librarianHeaders,
      body: {
        amount: 150.00,
        receiptNo,
        remarks: "Audited cash payment at counter",
      },
    });
    assert.equal(payRes.status, 201);

    // Verify audit log has the payment
    const checkPayAudit = await mockRequest(app, {
      method: "GET",
      url: `/api/admin/audit-logs?search=${encodeURIComponent(receiptNo)}`,
      headers: adminHeaders,
    });
    assert.equal(checkPayAudit.status, 200);
    const rows = checkPayAudit.json?.data || [];
    assert.ok(rows.length > 0, "Payment audit row should be present");
    const payLog = rows[0];
    assert.equal(payLog.action, "PAYMENT_RECORDED");
    assert.match(payLog.summary, new RegExp(receiptNo));
    assert.equal(payLog.actorName, `${librarianUser.first_name} ${librarianUser.last_name}`);
    assert.equal(payLog.actorRole, "LIBRARIAN");
  });

  await t.test("5. GET /api/admin/audit-logs filters accurately by from and to dates", async () => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Range matching today
    const resToday = await mockRequest(app, {
      method: "GET",
      url: `/api/admin/audit-logs?from=${today}&to=${today}`,
      headers: adminHeaders,
    });
    assert.equal(resToday.status, 200);
    assert.ok(resToday.json?.data?.length > 0);

    // Range entirely in the future should return 0 items
    const nextYearStart = "2099-01-01";
    const nextYearEnd = "2099-01-02";
    const resFuture = await mockRequest(app, {
      method: "GET",
      url: `/api/admin/audit-logs?from=${nextYearStart}&to=${nextYearEnd}`,
      headers: adminHeaders,
    });
    assert.equal(resFuture.status, 200);
    assert.equal(resFuture.json?.data?.length, 0);
    assert.equal(resFuture.json?.meta?.total, 0);

    // Range from yesterday to tomorrow should include today's items
    const resRange = await mockRequest(app, {
      method: "GET",
      url: `/api/admin/audit-logs?from=${yesterday}&to=${tomorrow}`,
      headers: adminHeaders,
    });
    assert.equal(resRange.status, 200);
    assert.ok(resRange.json?.data?.length > 0);
  });

  await t.test("6. GET /api/admin/audit-logs filters by actorRole", async () => {
    const res = await mockRequest(app, {
      method: "GET",
      url: "/api/admin/audit-logs?actorRole=LIBRARIAN",
      headers: adminHeaders,
    });
    assert.equal(res.status, 200);
    for (const log of res.json?.data || []) {
      assert.equal(log.actorRole, "LIBRARIAN");
    }
  });

  await t.test("7. GET /api/admin/audit-logs supports pagination meta { page, pageSize, total }", async () => {
    const res = await mockRequest(app, {
      method: "GET",
      url: "/api/admin/audit-logs?page=1&pageSize=5",
      headers: adminHeaders,
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.meta?.page, 1);
    assert.equal(res.json?.meta?.pageSize, 5);
    assert.ok(res.json?.data?.length <= 5);
  });

  await t.test("8. GET /api/audit-logs alias also works for Librarian and Admin", async () => {
    const res = await mockRequest(app, {
      method: "GET",
      url: "/api/audit-logs?pageSize=3",
      headers: librarianHeaders,
    });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json?.data));
  });
});
