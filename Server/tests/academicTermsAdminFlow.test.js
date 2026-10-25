// Server/tests/academicTermsAdminFlow.test.js
import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { User, Admin, Librarian, Student, AcademicTerm, AuditLog, sequelize } from "../models/index.js";
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

test("Academic Terms Admin Management Suite (Create & Update)", async (t) => {
  const stamp = Date.now();
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Create Admin
  const adminUser = await User.create({
    first_name: "Admin",
    last_name: `TermsAuditor_${stamp}`,
    email: `admin_terms_${stamp}@prestar.edu`,
    password_hash: passwordHash,
    role: "Admin",
    status: "Active",
    email_verified: true,
  });
  await Admin.create({
    user_id: adminUser.user_id,
    employee_number: `ADM-T-${stamp.toString().slice(-5)}`,
  });
  const adminToken = generateToken(adminUser);
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // 2. Create Librarian
  const librarianUser = await User.create({
    first_name: "Librarian",
    last_name: `TermsLib_${stamp}`,
    email: `lib_terms_${stamp}@prestar.edu`,
    password_hash: passwordHash,
    role: "Librarian",
    status: "Active",
    email_verified: true,
  });
  await Librarian.create({
    user_id: librarianUser.user_id,
    employee_number: `LIB-T-${stamp.toString().slice(-5)}`,
  });
  const librarianToken = generateToken(librarianUser);
  const librarianHeaders = { Authorization: `Bearer ${librarianToken}` };

  // 3. Create Student
  const studentUser = await User.create({
    first_name: "Student",
    last_name: "TermsStudent",
    email: `student_terms_${stamp}@wmsu.edu.ph`,
    password_hash: passwordHash,
    role: "Student",
    status: "Active",
    email_verified: true,
  });
  const studentToken = generateToken(studentUser);
  const studentHeaders = { Authorization: `Bearer ${studentToken}` };

  let createdTermId = null;
  const termName1 = `AY 2030-2031 · 1st Sem ${stamp}`;

  await t.test("1. Reject unauthenticated term creation (401)", async () => {
    const res = await mockRequest(app, {
      method: "POST",
      url: "/api/admin/academic-terms",
      body: {
        name: termName1,
        startDate: "2030-08-01",
        endDate: "2030-12-31",
        corDeadline: "2030-08-31",
      },
    });
    assert.equal(res.status, 401);
  });

  await t.test("2. Reject Student and Librarian access to create term (403)", async () => {
    const studentRes = await mockRequest(app, {
      method: "POST",
      url: "/api/admin/academic-terms",
      headers: studentHeaders,
      body: {
        name: termName1,
        startDate: "2030-08-01",
        endDate: "2030-12-31",
        corDeadline: "2030-08-31",
      },
    });
    assert.equal(studentRes.status, 403);

    const libRes = await mockRequest(app, {
      method: "POST",
      url: "/api/admin/academic-terms",
      headers: librarianHeaders,
      body: {
        name: termName1,
        startDate: "2030-08-01",
        endDate: "2030-12-31",
        corDeadline: "2030-08-31",
      },
    });
    assert.equal(libRes.status, 403);
  });

  await t.test("3. Validate required fields and date logic (422)", async () => {
    // Missing name
    const resNoName = await mockRequest(app, {
      method: "POST",
      url: "/api/admin/academic-terms",
      headers: adminHeaders,
      body: {
        startDate: "2030-08-01",
        endDate: "2030-12-31",
        corDeadline: "2030-08-31",
      },
    });
    assert.equal(resNoName.status, 422);

    // End date before start date
    const resInvalidDates = await mockRequest(app, {
      method: "POST",
      url: "/api/admin/academic-terms",
      headers: adminHeaders,
      body: {
        name: "Invalid Dates Term",
        startDate: "2030-12-31",
        endDate: "2030-08-01",
        corDeadline: "2030-08-31",
      },
    });
    assert.equal(resInvalidDates.status, 422);

    // COR deadline after end date
    const resCorAfterEnd = await mockRequest(app, {
      method: "POST",
      url: "/api/admin/academic-terms",
      headers: adminHeaders,
      body: {
        name: "Invalid COR Term",
        startDate: "2030-08-01",
        endDate: "2030-12-31",
        corDeadline: "2031-01-15",
      },
    });
    assert.equal(resCorAfterEnd.status, 422);
    assert.match(resCorAfterEnd.json?.message || resCorAfterEnd.json?.error, /COR deadline cannot be after the end date/i);
  });

  await t.test("4. Admin creates new academic term (201) and audits action", async () => {
    const res = await mockRequest(app, {
      method: "POST",
      url: "/api/admin/academic-terms",
      headers: adminHeaders,
      body: {
        name: termName1,
        startDate: "2030-08-01",
        endDate: "2030-12-31",
        corDeadline: "2030-08-31",
        status: "UPCOMING",
      },
    });

    assert.equal(res.status, 201);
    const term = res.json?.term || res.json?.data || res.json;
    assert.ok(term);
    assert.equal(term.name, termName1);
    assert.equal(term.startDate, "2030-08-01");
    assert.equal(term.endDate, "2030-12-31");
    assert.equal(term.corDeadline, "2030-08-31");
    assert.equal(term.status, "UPCOMING");
    assert.ok(term.id);
    createdTermId = term.id;

    // Verify audit log
    const auditRes = await mockRequest(app, {
      method: "GET",
      url: `/api/admin/audit-logs?search=${encodeURIComponent(termName1)}`,
      headers: adminHeaders,
    });
    assert.equal(auditRes.status, 200);
    const logs = auditRes.json?.data || [];
    assert.ok(logs.length > 0, "Audit log should exist for term creation");
    assert.equal(logs[0].action, "TERM_CREATED");
    assert.equal(logs[0].actorRole, "ADMIN");
  });

  await t.test("5. Reject duplicate academic term name (409 Conflict)", async () => {
    const res = await mockRequest(app, {
      method: "POST",
      url: "/api/admin/academic-terms",
      headers: adminHeaders,
      body: {
        name: termName1, // duplicate name
        startDate: "2030-08-01",
        endDate: "2030-12-31",
        corDeadline: "2030-08-31",
      },
    });
    assert.equal(res.status, 409);
    assert.match(res.json?.message || res.json?.error, /already exists/i);
  });

  await t.test("6. Reject updating term by non-Admin (403)", async () => {
    const res = await mockRequest(app, {
      method: "PATCH",
      url: `/api/admin/academic-terms/${createdTermId}`,
      headers: librarianHeaders,
      body: {
        corDeadline: "2030-09-15",
      },
    });
    assert.equal(res.status, 403);
  });

  await t.test("7. Return 404 for updating non-existent term ID", async () => {
    const res = await mockRequest(app, {
      method: "PATCH",
      url: "/api/admin/academic-terms/9999999",
      headers: adminHeaders,
      body: {
        name: "Non existent term",
      },
    });
    assert.equal(res.status, 404);
  });

  await t.test("8. Admin updates academic term details and status (200)", async () => {
    const updatedName = `${termName1} (Updated)`;
    const res = await mockRequest(app, {
      method: "PATCH",
      url: `/api/admin/academic-terms/${createdTermId}`,
      headers: adminHeaders,
      body: {
        name: updatedName,
        corDeadline: "2030-09-30",
        status: "COMPLETED",
      },
    });

    assert.equal(res.status, 200);
    const term = res.json?.term || res.json?.data || res.json;
    assert.equal(term.name, updatedName);
    assert.equal(term.corDeadline, "2030-09-30");
    assert.equal(term.status, "COMPLETED");

    // Verify in database
    const dbTerm = await AcademicTerm.findByPk(Number(createdTermId));
    assert.equal(dbTerm.term_name, updatedName);
    assert.equal(dbTerm.cor_deadline, "2030-09-30");
    assert.equal(dbTerm.status, "Completed");
  });

  await t.test("9. GET /api/admin/academic-terms lists terms and GET /:id returns details", async () => {
    const listRes = await mockRequest(app, {
      method: "GET",
      url: "/api/admin/academic-terms",
      headers: adminHeaders,
    });
    assert.equal(listRes.status, 200);
    const terms = Array.isArray(listRes.json) ? listRes.json : listRes.json?.data;
    assert.ok(Array.isArray(terms));
    const found = terms.find((t) => String(t.id) === String(createdTermId));
    assert.ok(found, "Updated term should appear in terms list");

    const detailRes = await mockRequest(app, {
      method: "GET",
      url: `/api/admin/academic-terms/${createdTermId}`,
      headers: adminHeaders,
    });
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.json?.name, `${termName1} (Updated)`);
  });

  await t.test("10. /api/academic-terms alias supports Admin creation and PUT update", async () => {
    const termName2 = `AY 2031-2032 · 2nd Sem ${stamp}`;
    const createRes = await mockRequest(app, {
      method: "POST",
      url: "/api/academic-terms",
      headers: adminHeaders,
      body: {
        name: termName2,
        startDate: "2031-01-05",
        endDate: "2031-05-30",
        corDeadline: "2031-02-15",
        status: "UPCOMING",
      },
    });
    assert.equal(createRes.status, 201);
    const term2 = createRes.json?.term || createRes.json?.data || createRes.json;

    const putRes = await mockRequest(app, {
      method: "PUT",
      url: `/api/academic-terms/${term2.id}`,
      headers: adminHeaders,
      body: {
        name: termName2,
        startDate: "2031-01-10",
        endDate: "2031-05-31",
        corDeadline: "2031-02-28",
        status: "UPCOMING",
      },
    });
    assert.equal(putRes.status, 200);
    const updated2 = putRes.json?.term || putRes.json?.data || putRes.json;
    assert.equal(updated2.startDate, "2031-01-10");
    assert.equal(updated2.corDeadline, "2031-02-28");
  });
});
