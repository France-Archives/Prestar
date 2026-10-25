// Server/tests/penaltyPaymentFlow.test.js
import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import {
  User,
  Student,
  Librarian,
  Author,
  Category,
  Book,
  BookCopy,
  BorrowRequest,
  BorrowedBook,
  Penalty,
  Payment,
  Notification,
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

test("Library Penalty Payment Process (Cash Only — Full Payment Only) Suite", async (t) => {
  const stamp = Date.now();
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Create Librarian
  const librarianUser = await User.create({
    first_name: "Librarian",
    last_name: `Test_${stamp}`,
    email: `librarian_fines_${stamp}@prestar.edu`,
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

  // 2. Create Student
  const studentUser = await User.create({
    first_name: "Student",
    last_name: `Borrower_${stamp}`,
    email: `student_fines_${stamp}@wmsu.edu.ph`,
    password_hash: passwordHash,
    role: "Student",
    status: "Active",
    email_verified: true,
  });
  const studentRecord = await Student.create({
    user_id: studentUser.user_id,
    student_number: `SN-${stamp.toString().slice(-6)}`,
    course: "BSCS",
    year_level: 3,
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

  // 3. Create Author, Category, Book & Copy
  const author = await Author.create({
    first_name: "Author",
    last_name: `Test_${stamp}`,
  });
  const category = (await Category.findOne()) || (await Category.create({
    category_name: `Category_${stamp}`,
  }));

  const book = await Book.create({
    title: `Fine Test Book ${stamp}`,
    isbn: `ISBN-F-${stamp}`,
    author_id: author.author_id,
    category_id: category.category_id,
    status: "Active",
  });
  const copy = await BookCopy.create({
    book_id: book.book_id,
    accession_no: `ACC-F-${stamp}`,
    condition_status: "Good",
    status: "Available",
  });

  // 4. Create BorrowRequest & BorrowedBook
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
    borrow_date: new Date(Date.now() - 10 * 86400000),
    due_date: new Date(Date.now() - 3 * 86400000),
    issued_by: librarianUser.user_id,
  });

  // 5. Create two penalties: one for Damaged Book (₱200), one for Lost Book (₱500)
  const penalty1 = await Penalty.create({
    borrow_id: borrow.borrow_id,
    penalty_type: "Damaged Book",
    amount: 200.00,
    status: "Unpaid",
    reason: "Water damage to pages 10-30",
    created_by: librarianUser.user_id,
  });

  const penalty2 = await Penalty.create({
    borrow_id: borrow.borrow_id,
    penalty_type: "Lost Book",
    amount: 500.00,
    status: "Unpaid",
    reason: "Book lost by student",
    created_by: librarianUser.user_id,
  });

  await t.test("1. GET /api/fines lists unpaid penalties with balance and student details", async () => {
    const res = await mockRequest(app, {
      method: "GET",
      url: "/api/fines?status=Unpaid",
      headers: librarianHeaders,
    });

    assert.equal(res.status, 200);
    const fines = res.json?.data || res.json?.fines;
    assert.ok(Array.isArray(fines));

    const found1 = fines.find((f) => String(f.id) === String(penalty1.penalty_id));
    assert.ok(found1, "Penalty 1 should be listed in unpaid fines");
    assert.equal(found1.status, "Unpaid");
    assert.equal(Number(found1.amount), 200);
    assert.equal(Number(found1.balance), 200);
    assert.equal(Number(found1.paidAmount), 0);
    assert.equal(found1.student.studentNumber, studentRecord.student_number);
    assert.equal(found1.bookTitle, book.title);
  });

  await t.test("2. POST /api/fines/:id/payments rejects missing receipt number", async () => {
    const res = await mockRequest(app, {
      method: "POST",
      url: `/api/fines/${penalty1.penalty_id}/payments`,
      headers: librarianHeaders,
      body: {
        amount: 200,
        // receiptNo missing
      },
    });

    assert.equal(res.status, 400);
    assert.match(res.json?.message || res.json?.error, /Receipt number is required/i);
  });

  await t.test("3. POST /api/fines/:id/payments rejects partial payment (< penalty.amount)", async () => {
    const res = await mockRequest(app, {
      method: "POST",
      url: `/api/fines/${penalty1.penalty_id}/payments`,
      headers: librarianHeaders,
      body: {
        amount: 100, // Penalty is 200, partial 100 rejected
        receiptNo: `OR-PARTIAL-${stamp}`,
      },
    });

    assert.equal(res.status, 400);
    assert.equal(res.json?.code, "PARTIAL_PAYMENT_NOT_ALLOWED");
    assert.match(res.json?.message, /Partial payments are not accepted\. Full payment of ₱200\.00 is required\./);
  });

  await t.test("4. POST /api/fines/:id/payments rejects overpayment (> penalty.amount)", async () => {
    const res = await mockRequest(app, {
      method: "POST",
      url: `/api/fines/${penalty1.penalty_id}/payments`,
      headers: librarianHeaders,
      body: {
        amount: 300, // Penalty is 200, overpayment 300 rejected
        receiptNo: `OR-OVER-${stamp}`,
      },
    });

    assert.equal(res.status, 400);
    assert.equal(res.json?.code, "PARTIAL_PAYMENT_NOT_ALLOWED");
  });

  const validReceiptNo = `OR-${stamp}-001`;

  await t.test("5. POST /api/fines/:id/payments records full cash payment with receipt number and settles penalty", async () => {
    const res = await mockRequest(app, {
      method: "POST",
      url: `/api/fines/${penalty1.penalty_id}/payments`,
      headers: librarianHeaders,
      body: {
        amount: 200.00,
        receiptNo: validReceiptNo,
        remarks: "Cash paid at circulation desk",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.json?.fine?.status, "Paid");
    assert.equal(res.json?.fine?.balance, 0);
    assert.equal(res.json?.payment?.receiptNo, validReceiptNo);
    assert.equal(res.json?.payment?.paymentMethod, "Cash");
    assert.equal(res.json?.payment?.paymentStatus, "Completed");

    // Verify DB update
    const updatedPenalty = await Penalty.findByPk(penalty1.penalty_id);
    assert.equal(updatedPenalty.status, "Paid");

    const createdPayment = await Payment.findOne({ where: { receipt_no: validReceiptNo } });
    assert.ok(createdPayment);
    assert.equal(Number(createdPayment.amount), 200);
    assert.equal(createdPayment.payment_method, "Cash");
    assert.equal(createdPayment.payment_status, "Completed");
    assert.equal(String(createdPayment.received_by), String(librarianUser.user_id));

    // Verify notification sent to student
    const notif = await Notification.findOne({
      where: {
        user_id: studentUser.user_id,
        type: "FINE_PAYMENT_RECORDED",
      },
      order: [["created_at", "DESC"]],
    });
    assert.ok(notif, "Notification should be sent to student");
    assert.match(notif.message, new RegExp(validReceiptNo));
    assert.match(notif.message, /₱200\.00 received in full/);
  });

  await t.test("6. POST /api/fines/:id/payments rejects duplicate payment on already resolved penalty", async () => {
    const res = await mockRequest(app, {
      method: "POST",
      url: `/api/fines/${penalty1.penalty_id}/payments`,
      headers: librarianHeaders,
      body: {
        amount: 200,
        receiptNo: `OR-AGAIN-${stamp}`,
      },
    });

    assert.equal(res.status, 400);
    assert.match(res.json?.message, /already been paid in full/i);
  });

  await t.test("7. POST /api/fines/:id/payments rejects duplicate receipt number across payments (409 Conflict)", async () => {
    // Attempt to use validReceiptNo on penalty2
    const res = await mockRequest(app, {
      method: "POST",
      url: `/api/fines/${penalty2.penalty_id}/payments`,
      headers: librarianHeaders,
      body: {
        amount: 500.00,
        receiptNo: validReceiptNo, // Already used in test 5
      },
    });

    assert.equal(res.status, 409);
    assert.equal(res.json?.code, "CONFLICT");
    assert.match(res.json?.message, /already exists in the system/);
  });

  await t.test("8. POST /api/fines/:id/waive waives an unpaid penalty with a reason and notifies student", async () => {
    const res = await mockRequest(app, {
      method: "POST",
      url: `/api/fines/${penalty2.penalty_id}/waive`,
      headers: librarianHeaders,
      body: {
        reason: "Book was misplaced in library stack and recovered by librarian",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.json?.fine?.status, "Waived");
    assert.equal(res.json?.fine?.waiveRemarks, "Book was misplaced in library stack and recovered by librarian");

    // Verify DB update
    const waived = await Penalty.findByPk(penalty2.penalty_id);
    assert.equal(waived.status, "Waived");
    assert.equal(String(waived.waived_by), String(librarianUser.user_id));

    // Verify notification sent to student
    const notif = await Notification.findOne({
      where: {
        user_id: studentUser.user_id,
        type: "FINE_WAIVED",
      },
      order: [["created_at", "DESC"]],
    });
    assert.ok(notif);
    assert.match(notif.message, /recovered by librarian/);
  });

  await t.test("9. GET /api/fines/payments returns settled payments history for PaymentRecordingPage", async () => {
    const res = await mockRequest(app, {
      method: "GET",
      url: `/api/fines/payments?search=${validReceiptNo}`,
      headers: librarianHeaders,
    });

    assert.equal(res.status, 200);
    const payments = res.json?.data || res.json?.payments;
    assert.ok(Array.isArray(payments));
    assert.ok(payments.length >= 1);

    const target = payments.find((p) => p.receiptNo === validReceiptNo);
    assert.ok(target, "Settled payment must be returned");
    assert.equal(target.receiptNo, validReceiptNo);
    assert.equal(target.referenceNumber, validReceiptNo); // Frontend compatibility
    assert.equal(Number(target.amount), 200);
    assert.equal(target.paymentMethod, "Cash");
    assert.equal(target.paymentStatus, "Completed");
    assert.equal(target.student.studentNumber, studentRecord.student_number);
    assert.equal(target.bookTitle, book.title);
    assert.match(target.recordedByName, /Librarian/);
  });

  await t.test("10. GET /api/me/penalties returns student's own penalties with cash instructions", async () => {
    const res = await mockRequest(app, {
      method: "GET",
      url: "/api/me/penalties",
      headers: studentHeaders,
    });

    assert.equal(res.status, 200);
    assert.match(res.json?.message, /Please pay in cash at the library counter/i);
    const fines = res.json?.data || res.json?.fines;
    assert.ok(Array.isArray(fines));

    const settled = fines.find((f) => String(f.id) === String(penalty1.penalty_id));
    assert.ok(settled);
    assert.equal(settled.status, "Paid");
    assert.equal(settled.receiptNo, validReceiptNo);

    const waived = fines.find((f) => String(f.id) === String(penalty2.penalty_id));
    assert.ok(waived);
    assert.equal(waived.status, "Waived");
  });
});
