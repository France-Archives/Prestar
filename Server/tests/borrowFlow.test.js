// Server/tests/borrowFlow.test.js
import assert from "node:assert/strict";
import test, { describe, it, before, after } from "node:test";
import { Op } from "sequelize";
import {
  Author,
  Book,
  BookCopy,
  BorrowedBook,
  BorrowRequest,
  Category,
  Notification,
  Penalty,
  sequelize,
  Suspension,
  User,
} from "../models/index.js";
import {
  cancelBorrowRequest,
  confirmBorrowPickup,
  createBorrowRequest,
  expirePickupRequests,
  listBorrowRequests,
  reviewBorrowRequest,
  BorrowRequestError,
} from "../services/borrowRequestService.js";
import { getBookDetails, listBooks } from "../services/bookService.js";
import { listNotifications, markNotificationRead } from "../services/notificationService.js";
import { BORROWABLE_COPY_WHERE, MAX_ACTIVE_BORROWS, LOAN_PERIOD_DAYS } from "../config/libraryRules.js";
import app from "../app.js";

describe("Borrow Flow Test Suite", () => {
  let adminUser;
  let testStudent;
  let otherStudent;
  let sampleBooks = [];
  let testBookNoCopies;
  let testBookDamagedOnly;

  before(async () => {
    // Find an existing active Admin or create one safely if not present
    adminUser = await User.findOne({ where: { role: "Admin", status: "Active" } });
    if (!adminUser) {
      adminUser = await User.create({
        email: `test-admin-${Date.now()}@university.edu`,
        password_hash: "hash",
        role: "Admin",
        status: "Active",
        first_name: "Admin",
        last_name: "Test",
        student_id: null,
      });
    }

    // Create isolated test students
    testStudent = await User.create({
      email: `test-student-${Date.now()}@university.edu`,
      password_hash: "hash",
      role: "Student",
      status: "Active",
      first_name: "Borrower",
      last_name: "Student",
      student_id: null,
    });

    otherStudent = await User.create({
      email: `other-student-${Date.now()}@university.edu`,
      password_hash: "hash",
      role: "Student",
      status: "Active",
      first_name: "Other",
      last_name: "Student",
      student_id: null,
    });

    // Grab available books from DB
    sampleBooks = await Book.findAll({
      where: { status: "Active" },
      limit: 15,
      order: [["book_id", "ASC"]],
    });

    const category = await Category.findOne();
    const author = await Author.findOne();

    // Create book with 0 copies
    testBookNoCopies = await Book.create({
      title: `No Copies Book ${Date.now()}`,
      isbn: `NOC-${Date.now()}`,
      category_id: category.category_id,
      author_id: author.author_id,
      status: "Active",
    });

    // Create book with only Damaged copies (condition != Good)
    testBookDamagedOnly = await Book.create({
      title: `Damaged Only Book ${Date.now()}`,
      isbn: `DMG-${Date.now()}`,
      category_id: category.category_id,
      author_id: author.author_id,
      status: "Active",
    });

    await BookCopy.create({
      book_id: testBookDamagedOnly.book_id,
      accession_no: `ACC-DMG-${Date.now()}`,
      status: "Available",
      condition_status: "Damaged",
    });
  });

  after(async () => {
    // Thorough non-destructive cleanup of test records only
    const userIds = [testStudent.id, otherStudent.id];

    await Notification.destroy({ where: { user_id: { [Op.in]: userIds } } });
    await Penalty.destroy({ where: { user_id: { [Op.in]: userIds } } });
    await Suspension.destroy({ where: { user_id: { [Op.in]: userIds } } });
    await BorrowedBook.destroy({ where: { user_id: { [Op.in]: userIds } } });
    await BorrowRequest.destroy({ where: { user_id: { [Op.in]: userIds } } });

    if (testBookDamagedOnly) {
      await BookCopy.destroy({ where: { book_id: testBookDamagedOnly.book_id } });
      await Book.destroy({ where: { book_id: testBookDamagedOnly.book_id } });
    }
    if (testBookNoCopies) {
      await Book.destroy({ where: { book_id: testBookNoCopies.book_id } });
    }

    await User.destroy({ where: { id: { [Op.in]: userIds } } });
    await sequelize.close();
  });

  describe("Suspension Date Windows", () => {
    it("blocks borrowing when suspension is Active and starts in past with no end date", async () => {
      const suspension = await Suspension.create({
        user_id: testStudent.id,
        reason_type: "Violation",
        reason_details: "Suspended indefinitely",
        suspended_by: adminUser.id,
        start_date: "2026-01-01",
        end_date: null,
        status: "Active",
      });

      await assert.rejects(
        () => createBorrowRequest(testStudent.id, sampleBooks[0].book_id),
        (err) => err instanceof BorrowRequestError && err.status === 403 && err.message.includes("active suspension")
      );

      await suspension.destroy();
    });

    it("blocks borrowing when suspension is Active, started in past, and ends today or in future", async () => {
      const suspension = await Suspension.create({
        user_id: testStudent.id,
        reason_type: "Damaged Book",
        reason_details: "Suspended through next week",
        suspended_by: adminUser.id,
        start_date: "2026-10-01",
        end_date: "2026-12-31",
        status: "Active",
      });

      await assert.rejects(
        () => createBorrowRequest(testStudent.id, sampleBooks[0].book_id),
        (err) => err instanceof BorrowRequestError && err.status === 403 && err.message.includes("active suspension")
      );

      await suspension.destroy();
    });

    it("allows borrowing when suspension is Active but starts in future", async () => {
      const suspension = await Suspension.create({
        user_id: testStudent.id,
        reason_type: "Other",
        reason_details: "Future suspension",
        suspended_by: adminUser.id,
        start_date: "2099-01-01",
        end_date: "2099-01-10",
        status: "Active",
      });

      const request = await createBorrowRequest(testStudent.id, sampleBooks[0].book_id);
      assert.ok(request);
      assert.equal(request.status, "Pending");

      await BorrowRequest.destroy({ where: { request_id: request.request_id } });
      await suspension.destroy();
    });

    it("allows borrowing when suspension is Active but ended in the past", async () => {
      const suspension = await Suspension.create({
        user_id: testStudent.id,
        reason_type: "Violation",
        reason_details: "Past suspension",
        suspended_by: adminUser.id,
        start_date: "2025-01-01",
        end_date: "2025-01-15",
        status: "Active",
      });

      const request = await createBorrowRequest(testStudent.id, sampleBooks[0].book_id);
      assert.ok(request);
      assert.equal(request.status, "Pending");

      await BorrowRequest.destroy({ where: { request_id: request.request_id } });
      await suspension.destroy();
    });

    it("allows borrowing when suspension status is not Active (e.g. Lifted)", async () => {
      const suspension = await Suspension.create({
        user_id: testStudent.id,
        reason_type: "Violation",
        reason_details: "Lifted suspension",
        suspended_by: adminUser.id,
        start_date: "2026-01-01",
        end_date: null,
        status: "Lifted",
        lifted_by: adminUser.id,
        lifted_at: new Date(),
        lift_remarks: "Reinstated",
      });

      const request = await createBorrowRequest(testStudent.id, sampleBooks[0].book_id);
      assert.ok(request);
      assert.equal(request.status, "Pending");

      await BorrowRequest.destroy({ where: { request_id: request.request_id } });
      await suspension.destroy();
    });
  });

  describe("Account, Penalty, and Overdue Checks", () => {
    it("blocks borrowing when user account is not active", async () => {
      await testStudent.update({ status: "Inactive" });

      await assert.rejects(
        () => createBorrowRequest(testStudent.id, sampleBooks[0].book_id),
        (err) => err instanceof BorrowRequestError && err.status === 403 && err.message.includes("account is not active")
      );

      await testStudent.update({ status: "Active" });
    });

    it("blocks borrowing when user has an unpaid penalty", async () => {
      const copy = await BookCopy.findOne({ where: { book_id: sampleBooks[0].book_id } });
      const loanReq = await BorrowRequest.create({
        user_id: testStudent.id,
        book_id: sampleBooks[0].book_id,
        status: "Issued",
      });
      const loan = await BorrowedBook.create({
        request_id: loanReq.request_id,
        user_id: testStudent.id,
        book_id: sampleBooks[0].book_id,
        copy_id: copy.copy_id,
        borrow_date: "2026-09-01",
        due_date: "2026-09-08",
        status: "Returned",
        issued_by: adminUser.id,
      });

      const penalty = await Penalty.create({
        borrow_id: loan.borrow_id,
        user_id: testStudent.id,
        created_by: adminUser.id,
        penalty_type: "Overdue",
        amount: 50.0,
        status: "Unpaid",
      });

      await assert.rejects(
        () => createBorrowRequest(testStudent.id, sampleBooks[1].book_id),
        (err) => err instanceof BorrowRequestError && err.status === 403 && err.message.includes("unpaid penalty")
      );

      await penalty.destroy();
      await loan.destroy();
      await loanReq.destroy();
    });

    it("allows borrowing when user penalties are Paid", async () => {
      const copy = await BookCopy.findOne({ where: { book_id: sampleBooks[0].book_id } });
      const loanReq = await BorrowRequest.create({
        user_id: testStudent.id,
        book_id: sampleBooks[0].book_id,
        status: "Issued",
      });
      const loan = await BorrowedBook.create({
        request_id: loanReq.request_id,
        user_id: testStudent.id,
        book_id: sampleBooks[0].book_id,
        copy_id: copy.copy_id,
        borrow_date: "2026-09-01",
        due_date: "2026-09-08",
        status: "Returned",
        issued_by: adminUser.id,
      });

      const penalty = await Penalty.create({
        borrow_id: loan.borrow_id,
        user_id: testStudent.id,
        created_by: adminUser.id,
        penalty_type: "Overdue",
        amount: 50.0,
        status: "Paid",
        paid_at: new Date(),
        received_by: adminUser.id,
        receipt_no: `REC-${Date.now()}`,
      });

      const request = await createBorrowRequest(testStudent.id, sampleBooks[1].book_id);
      assert.ok(request);
      assert.equal(request.status, "Pending");

      await BorrowRequest.destroy({ where: { request_id: request.request_id } });
      await penalty.destroy();
      await loan.destroy();
      await loanReq.destroy();
    });

    it("blocks borrowing when user has an overdue borrowed book", async () => {
      const copy = await BookCopy.findOne({ where: { book_id: sampleBooks[0].book_id } });
      const req = await BorrowRequest.create({
        user_id: testStudent.id,
        book_id: sampleBooks[0].book_id,
        status: "Issued",
      });

      const overdueLoan = await BorrowedBook.create({
        request_id: req.request_id,
        user_id: testStudent.id,
        book_id: sampleBooks[0].book_id,
        copy_id: copy.copy_id,
        borrow_date: "2026-09-01",
        due_date: "2026-09-08",
        status: "Borrowed",
        issued_by: adminUser.id,
      });

      await assert.rejects(
        () => createBorrowRequest(testStudent.id, sampleBooks[1].book_id),
        (err) => err instanceof BorrowRequestError && err.status === 403 && err.message.includes("overdue book")
      );

      await overdueLoan.destroy();
      await req.destroy();
    });
  });

  describe("Duplicate Requests and Same-Book Loan Policy", () => {
    it("blocks duplicate request when student already has a pending request for the book", async () => {
      const req = await createBorrowRequest(testStudent.id, sampleBooks[0].book_id);
      assert.equal(req.status, "Pending");

      await assert.rejects(
        () => createBorrowRequest(testStudent.id, sampleBooks[0].book_id),
        (err) => err instanceof BorrowRequestError && err.status === 403 && err.message.includes("pending or approved request")
      );

      await BorrowRequest.destroy({ where: { request_id: req.request_id } });
    });

    it("blocks duplicate request when student already has an approved request for the book", async () => {
      const req = await createBorrowRequest(testStudent.id, sampleBooks[0].book_id);
      const approved = await reviewBorrowRequest(req.request_id, adminUser.id, "approve", "Approved");
      assert.equal(approved.status, "Approved");

      await assert.rejects(
        () => createBorrowRequest(testStudent.id, sampleBooks[0].book_id),
        (err) => err instanceof BorrowRequestError && err.status === 403 && err.message.includes("pending or approved request")
      );

      await cancelBorrowRequest(approved.request_id, testStudent.id);
      await BorrowRequest.destroy({ where: { request_id: req.request_id } });
    });

    it("allows requesting a second copy of a book when student has 1 active loan for it", async () => {
      const copies = await BookCopy.findAll({ where: { book_id: sampleBooks[0].book_id, status: "Available" } });
      const parentReq1 = await BorrowRequest.create({
        user_id: testStudent.id,
        book_id: sampleBooks[0].book_id,
        status: "Issued",
      });

      const activeLoan1 = await BorrowedBook.create({
        request_id: parentReq1.request_id,
        user_id: testStudent.id,
        book_id: sampleBooks[0].book_id,
        copy_id: copies[0].copy_id,
        borrow_date: new Date(),
        due_date: "2026-10-20",
        status: "Borrowed",
        issued_by: adminUser.id,
      });

      // Request second copy
      const req2 = await createBorrowRequest(testStudent.id, sampleBooks[0].book_id);
      assert.ok(req2);
      assert.equal(req2.status, "Pending");

      await BorrowRequest.destroy({ where: { request_id: req2.request_id } });
      await activeLoan1.destroy();
      await parentReq1.destroy();
    });

    it("blocks request when student already has 2 active loans for the requested book", async () => {
      const copies = await BookCopy.findAll({ where: { book_id: sampleBooks[0].book_id, status: "Available" } });
      const parentReq1 = await BorrowRequest.create({
        user_id: testStudent.id,
        book_id: sampleBooks[0].book_id,
        status: "Issued",
      });
      const parentReq2 = await BorrowRequest.create({
        user_id: testStudent.id,
        book_id: sampleBooks[0].book_id,
        status: "Issued",
      });

      const activeLoan1 = await BorrowedBook.create({
        request_id: parentReq1.request_id,
        user_id: testStudent.id,
        book_id: sampleBooks[0].book_id,
        copy_id: copies[0].copy_id,
        borrow_date: new Date(),
        due_date: "2026-10-20",
        status: "Borrowed",
        issued_by: adminUser.id,
      });
      const activeLoan2 = await BorrowedBook.create({
        request_id: parentReq2.request_id,
        user_id: testStudent.id,
        book_id: sampleBooks[0].book_id,
        copy_id: copies[1].copy_id,
        borrow_date: new Date(),
        due_date: "2026-10-20",
        status: "Borrowed",
        issued_by: adminUser.id,
      });

      await assert.rejects(
        () => createBorrowRequest(testStudent.id, sampleBooks[0].book_id),
        (err) => err instanceof BorrowRequestError && err.status === 403 && err.message.includes("maximum allowed per title")
      );

      await activeLoan1.destroy();
      await activeLoan2.destroy();
      await parentReq1.destroy();
      await parentReq2.destroy();
    });
  });

  describe("Consistent Availability Rules & No-Copy Handling", () => {
    it("rejects request with 409 when book has 0 copies", async () => {
      await assert.rejects(
        () => createBorrowRequest(testStudent.id, testBookNoCopies.book_id),
        (err) => err instanceof BorrowRequestError && err.status === 409 && err.message.includes("No copies are currently available")
      );
    });

    it("rejects request with 409 when copy exists but condition is not Good (e.g. Damaged)", async () => {
      await assert.rejects(
        () => createBorrowRequest(testStudent.id, testBookDamagedOnly.book_id),
        (err) => err instanceof BorrowRequestError && err.status === 409 && err.message.includes("No copies are currently available")
      );
    });

    it("getBookDetails and listBooks reflect only Available and Good copies", async () => {
      const details = await getBookDetails(testBookDamagedOnly.book_id);
      assert.equal(details.available_copies, 0);

      const list = await listBooks({ search: testBookDamagedOnly.title, page: 1, limit: 10 });
      assert.equal(list.books.length, 1);
      assert.equal(list.books[0].get("available_copies"), 0);

      const goodDetails = await getBookDetails(sampleBooks[0].book_id);
      assert.ok(goodDetails.available_copies > 0);
    });
  });

  describe("Approval, Rejection, and Copy Reservation", () => {
    it("approving request reserves copy, sets pickup deadline, and creates notification", async () => {
      const req = await createBorrowRequest(testStudent.id, sampleBooks[1].book_id);
      assert.equal(req.status, "Pending");

      const reviewed = await reviewBorrowRequest(req.request_id, adminUser.id, "approve", "Take care of the book");
      assert.equal(reviewed.status, "Approved");
      assert.ok(reviewed.copy_id);
      assert.ok(reviewed.pickup_deadline);

      const assignedCopy = await BookCopy.findByPk(reviewed.copy_id);
      assert.equal(assignedCopy.status, "Reserved");

      const notifs = await Notification.findAll({
        where: { user_id: testStudent.id, related_request_id: req.request_id },
      });
      assert.ok(notifs.some((n) => n.type === "BORROW_REQUEST_APPROVED"));

      // Clean up by cancelling
      await cancelBorrowRequest(req.request_id, testStudent.id);
      const copyAfterCancel = await BookCopy.findByPk(reviewed.copy_id);
      assert.equal(copyAfterCancel.status, "Available");
    });

    it("rejecting request sets status to Rejected, records remarks, and creates notification", async () => {
      const req = await createBorrowRequest(testStudent.id, sampleBooks[2].book_id);
      const rejected = await reviewBorrowRequest(req.request_id, adminUser.id, "reject", "Not qualified for this title");
      assert.equal(rejected.status, "Rejected");
      assert.equal(rejected.remarks, "Not qualified for this title");

      const notifs = await Notification.findAll({
        where: { user_id: testStudent.id, related_request_id: req.request_id },
      });
      assert.ok(notifs.some((n) => n.type === "BORROW_REQUEST_REJECTED"));
    });

    it("cannot review a request that is not Pending", async () => {
      const req = await createBorrowRequest(testStudent.id, sampleBooks[2].book_id);
      await reviewBorrowRequest(req.request_id, adminUser.id, "reject", "Rejected once");

      await assert.rejects(
        () => reviewBorrowRequest(req.request_id, adminUser.id, "approve"),
        (err) => err instanceof BorrowRequestError && err.status === 409
      );
    });
  });

  describe("Pickup, Due-Date Calculation, and Expiry", () => {
    it("confirms pickup: marks copy Borrowed, calculates due_date as CURRENT_DATE + LOAN_PERIOD_DAYS, and notifies student", async () => {
      const req = await createBorrowRequest(testStudent.id, sampleBooks[3].book_id);
      const approved = await reviewBorrowRequest(req.request_id, adminUser.id, "approve");

      const borrow = await confirmBorrowPickup(approved.request_id, adminUser.id);
      assert.ok(borrow);
      assert.equal(borrow.status, "Borrowed");

      const copy = await BookCopy.findByPk(borrow.copy_id);
      assert.equal(copy.status, "Borrowed");

      const requestRow = await BorrowRequest.findByPk(approved.request_id);
      assert.equal(requestRow.status, "Issued");

      // Verify due date is LOAN_PERIOD_DAYS (7) days ahead of today
      const today = new Date().toISOString().slice(0, 10);
      const expectedDueDate = new Date(Date.now() + LOAN_PERIOD_DAYS * 86400000).toISOString().slice(0, 10);
      assert.ok(borrow.due_date >= today);
      assert.equal(borrow.due_date, expectedDueDate);

      const notifs = await Notification.findAll({
        where: { user_id: testStudent.id, related_request_id: approved.request_id },
      });
      assert.ok(notifs.some((n) => n.type === "BOOK_ISSUED"));

      // Clean up borrow
      await BorrowedBook.destroy({ where: { borrow_id: borrow.borrow_id } });
      await copy.update({ status: "Available" });
      await requestRow.destroy();
    });

    it("expires pickup request when pickup deadline has passed", async () => {
      const req = await createBorrowRequest(testStudent.id, sampleBooks[3].book_id);
      const approved = await reviewBorrowRequest(req.request_id, adminUser.id, "approve");

      // Simulate expired pickup deadline
      await approved.update({ pickup_deadline: new Date(Date.now() - 1000) });

      await assert.rejects(
        () => confirmBorrowPickup(approved.request_id, adminUser.id),
        (err) => err instanceof BorrowRequestError && err.status === 409
      );

      const copy = await BookCopy.findByPk(approved.copy_id);
      assert.equal(copy.status, "Available");

      const reqAfter = await BorrowRequest.findByPk(approved.request_id);
      assert.equal(reqAfter.status, "Expired");
      assert.equal(reqAfter.copy_id, null);

      const notifs = await Notification.findAll({
        where: { user_id: testStudent.id, related_request_id: approved.request_id },
      });
      assert.ok(notifs.some((n) => n.type === "BORROW_REQUEST_EXPIRED"));

      await reqAfter.destroy();
    });

    it("expirePickupRequests batch process releases copies and notifies students", async () => {
      const req = await createBorrowRequest(testStudent.id, sampleBooks[4].book_id);
      const approved = await reviewBorrowRequest(req.request_id, adminUser.id, "approve");
      await approved.update({ pickup_deadline: new Date(Date.now() - 5000) });

      const expiredCount = await expirePickupRequests();
      assert.ok(expiredCount >= 1);

      const copy = await BookCopy.findByPk(approved.copy_id);
      assert.equal(copy.status, "Available");

      await BorrowRequest.destroy({ where: { request_id: approved.request_id } });
    });
  });

  describe("Cancellation and Notification Ownership", () => {
    it("student can cancel their pending request", async () => {
      const req = await createBorrowRequest(testStudent.id, sampleBooks[5].book_id);
      const cancelled = await cancelBorrowRequest(req.request_id, testStudent.id);
      assert.equal(cancelled.status, "Cancelled");
    });

    it("student cannot cancel another student's request", async () => {
      const req = await createBorrowRequest(testStudent.id, sampleBooks[5].book_id);

      await assert.rejects(
        () => cancelBorrowRequest(req.request_id, otherStudent.id),
        (err) => err instanceof BorrowRequestError && err.status === 404
      );

      await cancelBorrowRequest(req.request_id, testStudent.id);
    });

    it("listNotifications returns only user's own notifications", async () => {
      const n1 = await Notification.create({
        user_id: testStudent.id,
        type: "TEST_A",
        message: "For student A",
      });
      const n2 = await Notification.create({
        user_id: otherStudent.id,
        type: "TEST_B",
        message: "For student B",
      });

      const studentANotifs = await listNotifications(testStudent.id);
      assert.ok(studentANotifs.some((n) => n.notification_id === n1.notification_id));
      assert.ok(!studentANotifs.some((n) => n.notification_id === n2.notification_id));

      const studentBNotifs = await listNotifications(otherStudent.id);
      assert.ok(studentBNotifs.some((n) => n.notification_id === n2.notification_id));
      assert.ok(!studentBNotifs.some((n) => n.notification_id === n1.notification_id));
    });

    it("user cannot mark another user's notification as read", async () => {
      const notif = await Notification.create({
        user_id: testStudent.id,
        type: "TEST_OWNERSHIP",
        message: "Private",
      });

      await assert.rejects(
        () => markNotificationRead(notif.notification_id, otherStudent.id),
        (err) => err.status === 404
      );

      const marked = await markNotificationRead(notif.notification_id, testStudent.id);
      assert.equal(marked.is_read, true);
    });
  });

  describe("Concurrent Capacity and Limit Enforcement", () => {
    it("blocks request when loan limit MAX_ACTIVE_BORROWS (10) is reached", async () => {
      const createdRequests = [];
      for (let i = 0; i < MAX_ACTIVE_BORROWS; i++) {
        const req = await BorrowRequest.create({
          user_id: testStudent.id,
          book_id: sampleBooks[i].book_id,
          status: "Pending",
        });
        createdRequests.push(req);
      }

      await assert.rejects(
        () => createBorrowRequest(testStudent.id, sampleBooks[11].book_id),
        (err) => err instanceof BorrowRequestError && err.status === 403 && err.message.includes("maximum allowed")
      );

      for (const r of createdRequests) {
        await r.destroy();
      }
    });

    it("concurrent createBorrowRequest at capacity - 1 serializes via user lock so limit 10 is never exceeded", async () => {
      const createdRequests = [];
      for (let i = 0; i < MAX_ACTIVE_BORROWS - 1; i++) {
        const req = await BorrowRequest.create({
          user_id: testStudent.id,
          book_id: sampleBooks[i].book_id,
          status: "Pending",
        });
        createdRequests.push(req);
      }

      // 9 items exist; two requests created in parallel for different books
      const results = await Promise.allSettled([
        createBorrowRequest(testStudent.id, sampleBooks[11].book_id),
        createBorrowRequest(testStudent.id, sampleBooks[12].book_id),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      assert.equal(fulfilled.length, 1, "Exactly one parallel request must succeed");
      assert.equal(rejected.length, 1, "The second parallel request must be rejected");
      assert.equal(rejected[0].reason.status, 403);
      assert.ok(rejected[0].reason.message.includes("maximum allowed"));

      // Clean up
      createdRequests.push(fulfilled[0].value);
      for (const r of createdRequests) {
        await r.destroy();
      }
    });

    it("concurrent request-versus-pickup capacity enforcement strictly preserves maximum of 10", async () => {
      const createdRequests = [];
      for (let i = 0; i < 9; i++) {
        const req = await BorrowRequest.create({
          user_id: testStudent.id,
          book_id: sampleBooks[i].book_id,
          status: "Pending",
        });
        createdRequests.push(req);
      }

      const copy = await BookCopy.findOne({ where: { book_id: sampleBooks[9].book_id, status: "Available" } });
      const approvedReq = await BorrowRequest.create({
        user_id: testStudent.id,
        book_id: sampleBooks[9].book_id,
        copy_id: copy.copy_id,
        status: "Approved",
        pickup_deadline: new Date(Date.now() + 3 * 86400000),
      });
      await copy.update({ status: "Reserved" });
      createdRequests.push(approvedReq);

      // Student currently has 9 pending + 1 approved = 10 items (capacity reached).
      // Fire createBorrowRequest and confirmBorrowPickup concurrently.
      const results = await Promise.allSettled([
        createBorrowRequest(testStudent.id, sampleBooks[10].book_id),
        confirmBorrowPickup(approvedReq.request_id, adminUser.id),
      ]);

      const rejected = results.find((r) => r.status === "rejected");
      const fulfilled = results.find((r) => r.status === "fulfilled");

      assert.ok(rejected, "One operation must be rejected at capacity");
      assert.equal(rejected.reason.status, 403);
      assert.ok(rejected.reason.message.includes("maximum allowed"));
      assert.ok(fulfilled, "The other operation must succeed");

      // Verify active count never exceeded 10
      const activeBorrows = await BorrowedBook.count({ where: { user_id: testStudent.id, status: "Borrowed" } });
      const openRequests = await BorrowRequest.count({
        where: { user_id: testStudent.id, status: { [Op.in]: ["Pending", "Approved"] } },
      });
      assert.ok(activeBorrows + openRequests <= MAX_ACTIVE_BORROWS);

      // Clean up
      await BorrowedBook.destroy({ where: { user_id: testStudent.id } });
      for (const r of createdRequests) {
        await r.destroy();
      }
      await copy.update({ status: "Available" });
    });
  });

  describe("Schema & Route Verification", () => {
    it("users.student_id column has no default '20' and is VARCHAR(20)", async () => {
      const [colInfo] = await sequelize.query(`
        SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'student_id';
      `);
      assert.equal(colInfo.length, 1);
      assert.equal(colInfo[0].data_type, "character varying");
      assert.equal(colInfo[0].character_maximum_length, 20);
      assert.equal(colInfo[0].column_default, null);
      assert.equal(colInfo[0].is_nullable, "YES");
    });

    it("preserves unique and foreign key constraints on users.student_id", async () => {
      const [constraints] = await sequelize.query(`
        SELECT conname, contype, pg_get_constraintdef(oid) as def
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass AND (conname = 'uq_user_student' OR conname = 'fk_users_student');
      `);
      assert.equal(constraints.length, 2);
      assert.ok(constraints.some((c) => c.conname === "uq_user_student" && c.contype === "u"));
      assert.ok(constraints.some((c) => c.conname === "fk_users_student" && c.contype === "f"));
    });

    it("express application and routes load cleanly", () => {
      assert.ok(app);
      assert.equal(typeof app.listen, "function");
    });
  });
});
