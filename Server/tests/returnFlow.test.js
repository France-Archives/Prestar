// Server/tests/returnFlow.test.js
import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import {
  AcademicTerm,
  Author,
  Book,
  BookCopy,
  BorrowedBook,
  BorrowRequest,
  Category,
  Notification,
  Penalty,
  Reservation,
  ReturnedBook,
  Student,
  StudentVerification,
  User,
  sequelize,
} from "../models/index.js";
import { getOrCreateTermForDate } from "../services/academicTermService.js";
import generateToken from "../utils/generateToken.js";
import app from "../app.js";

async function mockRequest(app, { method, url, headers = {}, body = null }) {
  const reqHeaders = { ...headers };
  if (body && typeof body === "object") {
    reqHeaders["content-type"] = "application/json";
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

describe("Book Return & Lost Loan Workflow Test Suite", () => {
  let librarianUser;
  let librarianToken;
  let studentUser;
  let studentRecord;
  let studentToken;
  let waitingStudentUser;
  let waitingStudentRecord;
  let testBook;
  let testCopy;
  let activeLoan;

  before(async () => {
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const ts = Date.now();

    // 1. Create Librarian
    librarianUser = await User.create({
      email: `librarian_return_${ts}@wmsu.edu.ph`,
      password_hash: passwordHash,
      first_name: "Librarian",
      last_name: "Staff",
      role: "Librarian",
      status: "Active",
      email_verified: true,
    });
    librarianToken = generateToken(librarianUser);

    // 2. Create Student
    studentUser = await User.create({
      email: `student_ret_${ts}@wmsu.edu.ph`,
      password_hash: passwordHash,
      first_name: "Alice",
      last_name: "Borrower",
      role: "Student",
      status: "Active",
      email_verified: true,
    });
    studentRecord = await Student.create({
      user_id: studentUser.user_id,
      student_number: `S-${String(ts).slice(-10)}`,
      college: "CCS",
      course: "BSCS",
      year_level: 3,
    });
    studentToken = generateToken(studentUser);

    const activeTerm = await getOrCreateTermForDate(new Date());
    await StudentVerification.create({
      user_id: studentUser.user_id,
      term_id: activeTerm.term_id,
      proof_file: "test_cor.png",
      status: "Approved",
      valid_from: "2026-08-01",
      valid_until: "2026-12-31",
      reviewed_by: librarianUser.user_id,
      reviewed_at: new Date(),
    });

    // 3. Create Waiting Student for reservation queue
    waitingStudentUser = await User.create({
      email: `student_w_${ts}@wmsu.edu.ph`,
      password_hash: passwordHash,
      first_name: "Bob",
      last_name: "Waiting",
      role: "Student",
      status: "Active",
      email_verified: true,
    });
    waitingStudentRecord = await Student.create({
      user_id: waitingStudentUser.user_id,
      student_number: `W-${String(ts).slice(-10)}`,
      college: "CCS",
      course: "BSCS",
      year_level: 2,
    });

    // 4. Create Category, Author, Book and Copy
    const category = await Category.create({
      category_name: `Category_Return_${ts}`,
      description: "Test Category",
    });

    const author = await Author.create({
      first_name: "Arthur",
      last_name: "Conan",
    });

    testBook = await Book.create({
      title: `Return Flow Book ${ts}`,
      isbn: `978${String(ts).slice(-10)}`,
      category_id: category.category_id,
      author_id: author.author_id,
      status: "Active",
    });

    testCopy = await BookCopy.create({
      book_id: testBook.book_id,
      accession_no: `ACC-RET-${ts}`,
      condition_status: "Good",
      status: "Borrowed",
    });

    // 5. Create BorrowRequest & active BorrowedBook (status = 'Borrowed')
    const borrowRequest = await BorrowRequest.create({
      user_id: studentUser.user_id,
      book_id: testBook.book_id,
      requested_days: 14,
      status: "Fulfilled",
      request_date: new Date(),
    });

    activeLoan = await BorrowedBook.create({
      request_id: borrowRequest.request_id,
      book_id: testBook.book_id,
      copy_id: testCopy.copy_id,
      status: "Borrowed",
      borrow_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // borrowed 5 days ago
      due_date: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // due in 9 days
      issued_by: librarianUser.user_id,
    });
  });

  after(async () => {
    // Cleanup created records
    try {
      if (activeLoan) {
        await ReturnedBook.destroy({ where: { borrow_id: activeLoan.borrow_id } });
        await Penalty.destroy({ where: { borrow_id: activeLoan.borrow_id } });
        await BorrowedBook.destroy({ where: { borrow_id: activeLoan.borrow_id } });
      }
      if (testCopy) await BookCopy.destroy({ where: { copy_id: testCopy.copy_id } });
      if (testBook) await Book.destroy({ where: { book_id: testBook.book_id } });
      if (studentRecord) await Student.destroy({ where: { user_id: studentUser.user_id } });
      if (studentUser) await User.destroy({ where: { user_id: studentUser.user_id } });
      if (waitingStudentRecord) await Student.destroy({ where: { user_id: waitingStudentUser.user_id } });
      if (waitingStudentUser) await User.destroy({ where: { user_id: waitingStudentUser.user_id } });
      if (librarianUser) await User.destroy({ where: { user_id: librarianUser.user_id } });
    } catch {}
  });

  it("1. GET /api/borrowed-books/:id returns full loan details for staff", async () => {
    const res = await mockRequest(app, {
      method: "GET",
      url: `/api/borrowed-books/${activeLoan.borrow_id}`,
      headers: { authorization: `Bearer ${librarianToken}` },
    });

    assert.equal(res.status, 200);
    assert.ok(res.json.loan, "Expected loan payload");
    assert.equal(res.json.loan.id, String(activeLoan.borrow_id));
    assert.equal(res.json.loan.status, "Borrowed");
    assert.equal(res.json.loan.book.title, testBook.title);
    assert.equal(res.json.loan.copy.accessionNo, testCopy.accession_no);
    assert.equal(res.json.loan.student.studentNumber, studentRecord.student_number);
  });

  it("2. Blocks non-staff from accessing staff loan details with 403", async () => {
    const res = await mockRequest(app, {
      method: "GET",
      url: `/api/borrowed-books/${activeLoan.borrow_id}`,
      headers: { authorization: `Bearer ${studentToken}` },
    });

    assert.equal(res.status, 403);
  });

  it("3. POST /api/borrowed-books/:id/return successfully accepts a returned book in GOOD condition", async () => {
    const res = await mockRequest(app, {
      method: "POST",
      url: `/api/borrowed-books/${activeLoan.borrow_id}/return`,
      headers: { authorization: `Bearer ${librarianToken}` },
      body: {
        condition: "GOOD",
        notes: "Book returned in pristine condition.",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.json.copyStatus, "AVAILABLE");
    assert.equal(res.json.loan.status, "Returned");

    // Check database state
    const reloadedLoan = await BorrowedBook.findByPk(activeLoan.borrow_id);
    assert.equal(reloadedLoan.status, "Returned");

    const reloadedCopy = await BookCopy.findByPk(testCopy.copy_id);
    assert.equal(reloadedCopy.status, "Available");
    assert.equal(reloadedCopy.condition_status, "Good");

    const returnedEntry = await ReturnedBook.findOne({ where: { borrow_id: activeLoan.borrow_id } });
    assert.ok(returnedEntry, "ReturnedBook record must exist");
    assert.equal(returnedEntry.condition_status, "Good");
    assert.equal(returnedEntry.days_overdue, 0);
    assert.equal(String(returnedEntry.received_by), String(librarianUser.user_id));
    assert.equal(returnedEntry.remarks, "Book returned in pristine condition.");

    // Check student received LOAN_RETURNED notification
    const notification = await Notification.findOne({
      where: {
        user_id: studentUser.user_id,
        type: "LOAN_RETURNED",
        related_entity_id: String(activeLoan.borrow_id),
      },
    });
    assert.ok(notification, "Student should receive LOAN_RETURNED notification");
  });

  it("4. Blocks double return with 409 conflict", async () => {
    const res = await mockRequest(app, {
      method: "POST",
      url: `/api/borrowed-books/${activeLoan.borrow_id}/return`,
      headers: { authorization: `Bearer ${librarianToken}` },
      body: { condition: "GOOD" },
    });

    assert.equal(res.status, 409);
    assert.equal(res.json.code, "INVALID_STATE");
  });

  it("5. Overdue return records days_overdue and Damaged condition sets copy to Maintenance", async () => {
    // Create new copy & overdue loan
    const copy2 = await BookCopy.create({
      book_id: testBook.book_id,
      accession_no: `ACC-OVD-${Date.now()}`,
      condition_status: "Good",
      status: "Borrowed",
    });

    const borrowReq2 = await BorrowRequest.create({
      user_id: studentUser.user_id,
      book_id: testBook.book_id,
      requested_days: 7,
      status: "Fulfilled",
      request_date: new Date(),
    });

    const overdueLoan = await BorrowedBook.create({
      request_id: borrowReq2.request_id,
      book_id: testBook.book_id,
      copy_id: copy2.copy_id,
      status: "Borrowed",
      borrow_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 5 days overdue
      issued_by: librarianUser.user_id,
    });

    const res = await mockRequest(app, {
      method: "POST",
      url: `/api/borrowed-books/${overdueLoan.borrow_id}/return`,
      headers: { authorization: `Bearer ${librarianToken}` },
      body: {
        condition: "DAMAGED",
        notes: "Cover torn and water damaged.",
        fineType: "DAMAGE_MINOR",
        fineAmount: 100,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.json.copyStatus, "MAINTENANCE");

    const reloadedCopy = await BookCopy.findByPk(copy2.copy_id);
    assert.equal(reloadedCopy.status, "Maintenance");
    assert.equal(reloadedCopy.condition_status, "Damaged");

    const returnRec = await ReturnedBook.findOne({ where: { borrow_id: overdueLoan.borrow_id } });
    assert.ok(returnRec.days_overdue >= 5, "Overdue days should be >= 5");
    assert.equal(returnRec.condition_status, "Damaged");

    // Check penalty was recorded
    assert.ok(res.json.penalty, "Damage penalty should be assessed");
    assert.equal(res.json.penalty.amount, 100);

    const penaltyInDb = await Penalty.findOne({ where: { borrow_id: overdueLoan.borrow_id } });
    assert.ok(penaltyInDb);
    assert.equal(Number(penaltyInDb.amount), 100);
    assert.equal(penaltyInDb.status, "Unpaid");
  });

  async function createVerifiedStudent(prefix) {
    const ts = Date.now() + Math.floor(Math.random() * 10000);
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const user = await User.create({
      email: `${prefix}_${ts}@wmsu.edu.ph`,
      password_hash: passwordHash,
      first_name: "Student",
      last_name: "Test",
      role: "Student",
      status: "Active",
      email_verified: true,
    });
    await Student.create({
      user_id: user.user_id,
      student_number: `S-${String(ts).slice(-10)}`,
      college: "CCS",
      course: "BSCS",
      year_level: 1,
    });
    const activeTerm = await getOrCreateTermForDate(new Date());
    await StudentVerification.create({
      user_id: user.user_id,
      term_id: activeTerm.term_id,
      proof_file: "test_cor.png",
      status: "Approved",
      valid_from: "2026-08-01",
      valid_until: "2026-12-31",
      reviewed_by: librarianUser.user_id,
      reviewed_at: new Date(),
    });
    return user;
  }

  it("6. Mark loan as lost creates ₱500 penalty, updates loan & copy status to Lost", async () => {
    const studentForLost = await createVerifiedStudent("student_lost");

    // Create new copy & loan to mark lost
    const copy3 = await BookCopy.create({
      book_id: testBook.book_id,
      accession_no: `ACC-LOST-${Date.now()}`,
      condition_status: "Good",
      status: "Borrowed",
    });

    const borrowReq3 = await BorrowRequest.create({
      user_id: studentForLost.user_id,
      book_id: testBook.book_id,
      requested_days: 7,
      status: "Fulfilled",
      request_date: new Date(),
    });

    const lostLoan = await BorrowedBook.create({
      request_id: borrowReq3.request_id,
      book_id: testBook.book_id,
      copy_id: copy3.copy_id,
      status: "Borrowed",
      borrow_date: new Date(),
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      issued_by: librarianUser.user_id,
    });

    const res = await mockRequest(app, {
      method: "POST",
      url: `/api/borrowed-books/${lostLoan.borrow_id}/mark-lost`,
      headers: { authorization: `Bearer ${librarianToken}` },
      body: {
        notes: "Borrower reported book was lost in typhoon flooding.",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.json.penalty.amount, 500);
    assert.equal(res.json.loan.status, "Lost");

    // Verify DB state
    const reloadedLoan = await BorrowedBook.findByPk(lostLoan.borrow_id);
    assert.equal(reloadedLoan.status, "Lost");

    const reloadedCopy = await BookCopy.findByPk(copy3.copy_id);
    assert.equal(reloadedCopy.status, "Lost");
    assert.equal(reloadedCopy.condition_status, "Damaged");

    const penaltyRec = await Penalty.findOne({ where: { borrow_id: lostLoan.borrow_id } });
    assert.ok(penaltyRec);
    assert.equal(Number(penaltyRec.amount), 500);
    assert.equal(penaltyRec.status, "Unpaid");

    // Verify student received notification
    const notification = await Notification.findOne({
      where: {
        user_id: studentForLost.user_id,
        type: "FINE_ASSESSED",
        related_entity_id: String(lostLoan.borrow_id),
      },
    });
    assert.ok(notification, "Student must receive FINE_ASSESSED notification");
  });

  it("7. Calling /api/staff/loans/:id/return route alias behaves identically", async () => {
    const studentForAlias = await createVerifiedStudent("student_alias");

    const copy4 = await BookCopy.create({
      book_id: testBook.book_id,
      accession_no: `ACC-ALIAS-${Date.now()}`,
      condition_status: "Good",
      status: "Borrowed",
    });

    const borrowReq4 = await BorrowRequest.create({
      user_id: studentForAlias.user_id,
      book_id: testBook.book_id,
      requested_days: 7,
      status: "Fulfilled",
      request_date: new Date(),
    });

    const aliasLoan = await BorrowedBook.create({
      request_id: borrowReq4.request_id,
      book_id: testBook.book_id,
      copy_id: copy4.copy_id,
      status: "Borrowed",
      borrow_date: new Date(),
      due_date: new Date().toISOString().slice(0, 10),
      issued_by: librarianUser.user_id,
    });

    const res = await mockRequest(app, {
      method: "POST",
      url: `/api/staff/loans/${aliasLoan.borrow_id}/return`,
      headers: { authorization: `Bearer ${librarianToken}` },
      body: { condition: "FAIR" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.json.copyStatus, "AVAILABLE");
    assert.equal(res.json.loan.status, "Returned");
  });

  it("8. Student can self-report their own loan as lost, automatically assessing ₱500 penalty", async () => {
    const studentOwner = await createVerifiedStudent("student_owner");
    const ownerToken = generateToken(studentOwner);

    const copy5 = await BookCopy.create({
      book_id: testBook.book_id,
      accession_no: `ACC-STULOST-${Date.now()}`,
      condition_status: "Good",
      status: "Borrowed",
    });

    const borrowReq5 = await BorrowRequest.create({
      user_id: studentOwner.user_id,
      book_id: testBook.book_id,
      requested_days: 7,
      status: "Fulfilled",
      request_date: new Date(),
    });

    const studentLoan = await BorrowedBook.create({
      request_id: borrowReq5.request_id,
      book_id: testBook.book_id,
      copy_id: copy5.copy_id,
      status: "Borrowed",
      borrow_date: new Date(),
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      issued_by: librarianUser.user_id,
    });

    // Student calls /report-lost on their own loan
    const res = await mockRequest(app, {
      method: "POST",
      url: `/api/borrowed-books/${studentLoan.borrow_id}/report-lost`,
      headers: { authorization: `Bearer ${ownerToken}` },
      body: {
        notes: "Left the book on the bus and could not recover it.",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.json.loan.status, "Lost");
    assert.equal(res.json.penalty.amount, 500);
    assert.equal(res.json.penalty.status, "UNPAID");

    // Verify DB penalty record
    const penaltyInDb = await Penalty.findOne({ where: { borrow_id: studentLoan.borrow_id } });
    assert.ok(penaltyInDb);
    assert.equal(Number(penaltyInDb.amount), 500);
    assert.equal(penaltyInDb.status, "Unpaid");
    assert.match(penaltyInDb.reason, /Self-reported as lost/);

    // Verify copy state
    const reloadedCopy = await BookCopy.findByPk(copy5.copy_id);
    assert.equal(reloadedCopy.status, "Lost");
    assert.equal(reloadedCopy.condition_status, "Damaged");

    // Verify student received FINE_ASSESSED notification
    const notif = await Notification.findOne({
      where: {
        user_id: studentOwner.user_id,
        type: "FINE_ASSESSED",
        related_entity_id: String(studentLoan.borrow_id),
      },
    });
    assert.ok(notif);
    assert.equal(notif.title, "Book reported as lost");
  });

  it("9. Student cannot mark another student's loan as lost (403 Forbidden)", async () => {
    const studentVictim = await createVerifiedStudent("student_vic");
    const maliciousStudent = await createVerifiedStudent("student_mal");
    const maliciousToken = generateToken(maliciousStudent);

    const copy6 = await BookCopy.create({
      book_id: testBook.book_id,
      accession_no: `ACC-FORBID-${Date.now()}`,
      condition_status: "Good",
      status: "Borrowed",
    });

    const borrowReq6 = await BorrowRequest.create({
      user_id: studentVictim.user_id,
      book_id: testBook.book_id,
      requested_days: 7,
      status: "Fulfilled",
      request_date: new Date(),
    });

    const victimLoan = await BorrowedBook.create({
      request_id: borrowReq6.request_id,
      book_id: testBook.book_id,
      copy_id: copy6.copy_id,
      status: "Borrowed",
      borrow_date: new Date(),
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      issued_by: librarianUser.user_id,
    });

    // Malicious student tries to mark victim's loan as lost
    const res = await mockRequest(app, {
      method: "POST",
      url: `/api/borrowed-books/${victimLoan.borrow_id}/report-lost`,
      headers: { authorization: `Bearer ${maliciousToken}` },
      body: { notes: "I am trying to grief another student" },
    });

    assert.equal(res.status, 403);
    assert.equal(res.json.code, "FORBIDDEN");

    // Verify loan is untouched
    const untouchedLoan = await BorrowedBook.findByPk(victimLoan.borrow_id);
    assert.equal(untouchedLoan.status, "Borrowed");
  });
});
