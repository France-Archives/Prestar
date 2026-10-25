// Server/tests/studentNotificationsFlow.test.js
import assert from "node:assert/strict";
import test, { describe, it, before, after } from "node:test";
import {
  AcademicTerm,
  Author,
  Book,
  BookCopy,
  BorrowedBook,
  BorrowRequest,
  Category,
  Notification,
  Reservation,
  Student,
  StudentVerification,
  User,
  sequelize,
} from "../models/index.js";
import {
  createBorrowRequest,
  reviewBorrowRequest,
  pickupBook,
  rejectPickupBook,
  expireStalePickups,
} from "../services/borrowFlowService.js";
import {
  createReservation,
  processNextInReservationQueue,
} from "../services/reservationService.js";

describe("Student Lifecycle Notifications Test Suite", () => {
  const uniqueSuffix = Date.now();
  let category;
  let author;
  let activeTerm;
  let testBookWithCopies;
  let testBookZeroCopies;
  let testStudentUser;
  let adminUser;
  let copyA;

  before(async () => {
    category = await Category.findOne();
    if (!category) {
      category = await Category.create({ name: `Category_${uniqueSuffix}` });
    }

    author = await Author.findOne();
    if (!author) {
      author = await Author.create({ name: `Author_${uniqueSuffix}` });
    }

    activeTerm = await AcademicTerm.findOne({ where: { status: "Active" } });
    if (!activeTerm) {
      activeTerm = await AcademicTerm.create({
        term_name: `Term_${uniqueSuffix}`,
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        status: "Active",
      });
    }

    // Create admin user for reviewing/pickup
    adminUser = await User.create({
      first_name: "Admin",
      last_name: "Staff",
      email: `admin_${uniqueSuffix}@prestar.edu`,
      password_hash: "hash123",
      role: "Admin",
      status: "Active",
    });

    // Create test student user
    testStudentUser = await User.create({
      first_name: "Juan",
      last_name: "Dela Cruz",
      email: `student_${uniqueSuffix}@wmsu.edu.ph`,
      password_hash: "hash123",
      role: "Student",
      status: "Active",
      email_verified: true,
    });

    await Student.create({
      user_id: testStudentUser.user_id,
      student_number: `SN-${uniqueSuffix}`,
      course: "BSCS",
      year_level: 3,
    });

    await StudentVerification.create({
      user_id: testStudentUser.user_id,
      term_id: activeTerm.term_id,
      proof_file: Buffer.from("proof"),
      status: "Approved",
      reviewed_by: adminUser.user_id,
      reviewed_at: new Date(),
      valid_from: "2026-01-01",
      valid_until: "2026-12-31",
    });

    // Book with copies
    testBookWithCopies = await Book.create({
      title: `Operating Systems Principles ${uniqueSuffix}`,
      category_id: category.category_id,
      author_id: author.author_id,
      isbn: `NOTIF-A-${String(uniqueSuffix).slice(-10)}`,
      publication_year: 2024,
      total_copies: 2,
      available_copies: 2,
      status: "Active",
    });

    copyA = await BookCopy.create({
      book_id: testBookWithCopies.book_id,
      copy_number: 1,
      barcode: `BAR-NOTIF-${uniqueSuffix}-1`,
      accession_no: `ACC-NOTIF-${uniqueSuffix}-1`,
      shelf_location: "Shelf-101",
      status: "Available",
      condition_status: "Good",
    });

    // Book with 0 copies
    testBookZeroCopies = await Book.create({
      title: `Distributed Systems Architecture ${uniqueSuffix}`,
      category_id: category.category_id,
      author_id: author.author_id,
      isbn: `NOTIF-B-${String(uniqueSuffix).slice(-10)}`,
      publication_year: 2024,
      total_copies: 0,
      available_copies: 0,
      status: "Active",
    });
  });

  after(async () => {
    try {
      if (testBookWithCopies && testBookZeroCopies) {
        const testBookIds = [testBookWithCopies.book_id, testBookZeroCopies.book_id];
        await BorrowedBook.destroy({ where: { book_id: testBookIds } });
        await BorrowRequest.destroy({ where: { book_id: testBookIds } });
        await Reservation.destroy({ where: { book_id: testBookIds } });
        await BookCopy.destroy({ where: { book_id: testBookIds } });
        await Book.destroy({ where: { book_id: testBookIds } });
      }
      if (testStudentUser) {
        await Notification.destroy({ where: { user_id: testStudentUser.user_id } });
        await BorrowRequest.destroy({ where: { user_id: testStudentUser.user_id } });
        await Reservation.destroy({ where: { user_id: testStudentUser.user_id } });
        await StudentVerification.destroy({ where: { user_id: testStudentUser.user_id } });
        await Student.destroy({ where: { user_id: testStudentUser.user_id } });
        await User.destroy({ where: { user_id: testStudentUser.user_id } });
      }
      if (adminUser) {
        await User.destroy({ where: { user_id: adminUser.user_id } });
      }
    } catch (cleanupErr) {
      console.warn("Cleanup error:", cleanupErr.message);
    }
  });

  it("1. Creates BORROW_REQUEST_APPROVED notification when borrow request is created/approved", async () => {
    const req = await createBorrowRequest({
      userId: testStudentUser.user_id,
      bookId: testBookWithCopies.book_id,
      requestedDays: 7,
    });

    assert.equal(req.status, "Approved");

    const notif = await Notification.findOne({
      where: {
        user_id: testStudentUser.user_id,
        type: "BORROW_REQUEST_APPROVED",
        related_entity_id: req.requestId,
      },
      order: [["created_at", "DESC"]],
    });

    assert.ok(notif, "BORROW_REQUEST_APPROVED notification should exist");
    assert.equal(notif.title, "Request approved");
    assert.ok(notif.message.includes(testBookWithCopies.title));
    assert.ok(notif.message.includes("Pick it up by"));
  });

  it("2. Creates LOAN_ISSUED notification when pickup handover is confirmed", async () => {
    const borrowReq = await BorrowRequest.findOne({
      where: {
        user_id: testStudentUser.user_id,
        book_id: testBookWithCopies.book_id,
        status: "Approved",
      },
    });
    assert.ok(borrowReq);

    const result = await pickupBook({
      requestId: borrowReq.request_id,
      issuerId: adminUser.user_id,
    });

    assert.equal(result.status, "Borrowed");

    const notif = await Notification.findOne({
      where: {
        user_id: testStudentUser.user_id,
        type: "LOAN_ISSUED",
        related_entity_id: result.borrowId,
      },
      order: [["created_at", "DESC"]],
    });

    assert.ok(notif, "LOAN_ISSUED notification should exist");
    assert.equal(notif.title, "Book issued");
    assert.ok(notif.message.includes(testBookWithCopies.title));
    assert.ok(notif.message.includes("It is due on"));
  });

  it("3. Creates RESERVATION_CONFIRMED notification when student reserves out-of-stock book", async () => {
    const res = await createReservation({
      userId: testStudentUser.user_id,
      bookId: testBookZeroCopies.book_id,
      requestedDays: 7,
    });

    assert.equal(res.status, "Waiting");

    const notif = await Notification.findOne({
      where: {
        user_id: testStudentUser.user_id,
        type: "RESERVATION_CONFIRMED",
        related_entity_id: res.reservationId,
      },
      order: [["created_at", "DESC"]],
    });

    assert.ok(notif, "RESERVATION_CONFIRMED notification should exist");
    assert.equal(notif.title, "Reservation confirmed");
    assert.ok(notif.message.includes(testBookZeroCopies.title));
    assert.ok(notif.message.includes("reservation queue"));
  });

  it("4. Creates RESERVATION_OFFERED notification when a copy becomes available for waiting student", async () => {
    // Add a copy to the zero-copies book so queue processor can allocate it
    const newCopy = await BookCopy.create({
      book_id: testBookZeroCopies.book_id,
      copy_number: 1,
      barcode: `BAR-RES-${uniqueSuffix}`,
      accession_no: `ACC-RES-${uniqueSuffix}`,
      shelf_location: "Shelf-102",
      status: "Available",
      condition_status: "Good",
    });

    const allocated = await processNextInReservationQueue(testBookZeroCopies.book_id);
    assert.ok(allocated, "Queue processor should allocate copy");
    assert.equal(allocated.studentId, testStudentUser.user_id);

    const notif = await Notification.findOne({
      where: {
        user_id: testStudentUser.user_id,
        type: "RESERVATION_OFFERED",
        related_entity_id: allocated.reservationId,
      },
      order: [["created_at", "DESC"]],
    });

    assert.ok(notif, "RESERVATION_OFFERED notification should exist");
    assert.equal(notif.title, "A copy is ready");
    assert.ok(notif.message.includes(testBookZeroCopies.title));
    assert.ok(notif.message.includes("is held for you until"));

    await BorrowedBook.destroy({ where: { copy_id: newCopy.copy_id } });
    await BookCopy.destroy({ where: { copy_id: newCopy.copy_id } });
  });

  it("5. Creates HANDOVER_REJECTED notification when staff rejects pickup at counter", async () => {
    // Student creates another borrow request on available book
    const tempBook = await Book.create({
      title: `Compilers Design ${uniqueSuffix}`,
      category_id: category.category_id,
      author_id: author.author_id,
      isbn: `NOTIF-C-${String(uniqueSuffix).slice(-10)}`,
      publication_year: 2024,
      total_copies: 1,
      available_copies: 1,
      status: "Active",
    });
    const tempCopy = await BookCopy.create({
      book_id: tempBook.book_id,
      copy_number: 1,
      barcode: `BAR-TEMP-${uniqueSuffix}`,
      accession_no: `ACC-TEMP-${uniqueSuffix}`,
      shelf_location: "Shelf-103",
      status: "Available",
      condition_status: "Good",
    });

    const req = await createBorrowRequest({
      userId: testStudentUser.user_id,
      bookId: tempBook.book_id,
      requestedDays: 7,
    });

    const rejectRes = await rejectPickupBook({
      requestId: req.requestId,
      staffId: adminUser.user_id,
      remarks: "ID barcode unreadable",
    });

    assert.equal(rejectRes.status, "Rejected");

    const notif = await Notification.findOne({
      where: {
        user_id: testStudentUser.user_id,
        type: "HANDOVER_REJECTED",
        related_entity_id: req.requestId,
      },
      order: [["created_at", "DESC"]],
    });

    assert.ok(notif, "HANDOVER_REJECTED notification should exist");
    assert.equal(notif.title, "Handover not possible");
    assert.ok(notif.message.includes("ID barcode unreadable"));

    await BorrowedBook.destroy({ where: { request_id: req.requestId } });
    await BorrowRequest.destroy({ where: { request_id: req.requestId } });
    await BookCopy.destroy({ where: { copy_id: tempCopy.copy_id } });
    await Book.destroy({ where: { book_id: tempBook.book_id } });
  });
});
