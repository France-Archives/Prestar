// Server/tests/bookProcessFlow.test.js
import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  Author,
  Book,
  BookCopy,
  BorrowRequest,
  BorrowedBook,
  Category,
  EmailOtp,
  Student,
  User,
  AcademicTerm,
  StudentVerification,
  sequelize,
} from "../models/index.js";
import {
  createSignup,
  verifyOtp,
} from "../services/signupService.js";
import {
  cancelBorrowRequest,
  createBorrowRequest,
  listMyBorrowRequests,
  pickupBook,
  rejectPickupBook,
  reviewBorrowRequest,
} from "../services/borrowFlowService.js";
import {
  getBookDetails,
  getTopBorrowedBooks,
  listBooks,
} from "../services/bookService.js";

describe("Book Process & Frontend Form Integration Test Suite", () => {
  let testUser;
  let testStudent;
  let staffUser;
  let testBook;
  let testCopy;
  let testTerm;
  let testVerification;
  let uniqueSuffix;

  before(async () => {
    uniqueSuffix = Date.now();

    // 1. Setup staff user
    staffUser = await User.create({
      first_name: "Librarian",
      last_name: "Staff",
      email: `staff_${uniqueSuffix}@prestar.edu`,
      password_hash: "dummyhash",
      role: "Librarian",
      status: "Active",
      email_verified: true,
    });

    // 2. Setup active academic term
    testTerm = await AcademicTerm.findOne({ where: { status: "Active" } });
    if (!testTerm) {
      testTerm = await AcademicTerm.create({
        term_name: `Term ${uniqueSuffix}`,
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: "Active",
      });
    }

    // 3. Setup test book with an available copy
    const author = await Author.create({
      first_name: "Donald",
      last_name: "Knuth",
    });

    const category = await Category.findOne() || await Category.create({
      category_name: "Computer Science",
    });

    testBook = await Book.create({
      title: `The Art of Computer Programming ${uniqueSuffix}`,
      author_id: author.author_id,
      category_id: category.category_id,
      isbn: `978-${String(uniqueSuffix).slice(-10)}`,
      status: "Active",
    });

    testCopy = await BookCopy.create({
      book_id: testBook.book_id,
      accession_no: `ACC-${uniqueSuffix}-01`,
      status: "Available",
      condition_status: "Good",
    });
  });

  it("1. Handles student signup with frontend naming (program -> course, studentNumber, yearLevel)", async () => {
    const signupData = {
      firstName: "Maria",
      lastName: "Santos",
      studentNumber: `SN-${uniqueSuffix}`,
      program: "BS Computer Science", // Frontend sends program
      yearLevel: 3, // Frontend sends yearLevel
      email: `student_${uniqueSuffix}@wmsu.edu.ph`,
      password: "StrongPassword123!",
    };

    const signupRes = await createSignup(signupData);
    assert.equal(signupRes.email, signupData.email);

    // Verify stored signup_payload in EmailOtp maps program to course
    const otpRecord = await EmailOtp.findOne({ where: { email: signupData.email } });
    assert.ok(otpRecord);
    assert.equal(otpRecord.signup_payload.course, "BS Computer Science");
    assert.equal(otpRecord.signup_payload.first_name, "Maria");
    assert.equal(otpRecord.signup_payload.student_number, `SN-${uniqueSuffix}`);

    // Fast-forward OTP verification
    const bcrypt = (await import("bcrypt")).default;
    const testCode = "123456";
    const otpHashed = await bcrypt.hash(testCode, 10);
    await otpRecord.update({ otp_hash: otpHashed });

    const verifyRes = await verifyOtp(signupData.email, testCode);
    assert.equal(verifyRes.message, "Registration successful. You may now log in.");

    // Check DB student record
    testUser = await User.findOne({ where: { email: signupData.email } });
    testStudent = await Student.findOne({ where: { user_id: testUser.id } });
    assert.ok(testStudent);
    assert.equal(testStudent.course, "BS Computer Science");
    assert.equal(testStudent.year_level, 3);
    assert.equal(testStudent.student_number, `SN-${uniqueSuffix}`);

    // Add approved StudentVerification for active term so student is eligible to borrow
    testVerification = await StudentVerification.create({
      user_id: testUser.id,
      term_id: testTerm.term_id,
      proof_file: Buffer.from("dummy-cor-proof"),
      status: "Approved",
      reviewed_by: staffUser.id,
      reviewed_at: new Date(),
      valid_from: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      valid_until: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
  });

  it("2. Handles borrow request with dropdown loan duration (e.g. 14 days)", async () => {
    // Frontend sends bookId and requestedDurationDays
    const requestedDays = 14;
    const requestRes = await createBorrowRequest({
      userId: testUser.id,
      bookId: testBook.book_id,
      requestedDays,
    });

    assert.ok(requestRes);
    assert.equal(requestRes.requestedDurationDays, 14);
    assert.equal(requestRes.status, "Approved");
    assert.ok(requestRes.loan);
    assert.equal(requestRes.loan.status, "Reserved");
    assert.equal(requestRes.assignedCopyId, testCopy.copy_id);

    // Verify stored in DB borrow_requests table
    const dbReq = await BorrowRequest.findByPk(requestRes.id);
    assert.ok(dbReq);
    assert.equal(dbReq.requested_days, 14);
    assert.equal(dbReq.status, "Approved");

    // Copy status is Reserved
    const copy = await BookCopy.findByPk(testCopy.copy_id);
    assert.equal(copy.status, "Reserved");

    // Verify row created in borrowed_books
    const loan = await BorrowedBook.findOne({ where: { request_id: requestRes.id } });
    assert.ok(loan);
    assert.equal(loan.status, "Reserved");
  });

  it("3. Student lists own requests and receives clean camelCase properties", async () => {
    const listRes = await listMyBorrowRequests(testUser.id, { page: 1, limit: 10 });
    assert.ok(listRes.requests.length >= 1);

    const first = listRes.requests[0];
    assert.equal(first.requestedDurationDays, 14);
    assert.equal(first.bookId, testBook.book_id);
    assert.equal(first.status, "Approved");
  });

  it("4. System assigns copy and creates Reserved loan record upon borrow request", async () => {
    const loan = await BorrowedBook.findOne({
      where: { book_id: testBook.book_id, status: "Reserved" },
    });
    assert.ok(loan);
    assert.equal(loan.status, "Reserved");

    // Copy status is Reserved
    const copy = await BookCopy.findByPk(testCopy.copy_id);
    assert.equal(copy.status, "Reserved");
  });

  it("5. Staff handover confirms physical pickup and sets due_date from requested duration", async () => {
    const loan = await BorrowedBook.findOne({
      where: { book_id: testBook.book_id, status: "Reserved" },
    });
    assert.ok(loan);

    const pickupRes = await pickupBook({
      borrowId: loan.borrow_id,
      issuerId: staffUser.id,
    });

    assert.equal(pickupRes.status, "Borrowed");
    assert.ok(pickupRes.dueAt || pickupRes.dueDate);

    // Verify due_date is approximately 14 days from now
    const now = new Date();
    const dueDate = new Date(pickupRes.dueAt || pickupRes.dueDate);
    const diffDays = Math.round((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    assert.ok(diffDays >= 13 && diffDays <= 15, `Expected ~14 days diff, got ${diffDays}`);
  });

  it("6. Student can cancel an open request and release reserved copy", async () => {
    // Create second copy and second request with 21 days from dropdown
    const secondCopy = await BookCopy.create({
      book_id: testBook.book_id,
      accession_no: `ACC-${uniqueSuffix}-02`,
      status: "Available",
      condition_status: "Good",
    });

    const newReq = await createBorrowRequest({
      userId: testUser.id,
      bookId: testBook.book_id,
      requestedDays: 21,
    });

    await reviewBorrowRequest({
      requestId: newReq.id,
      reviewerId: staffUser.id,
      decision: "approve",
      remarks: "Approved",
      copyId: secondCopy.copy_id,
    });

    // Student cancels the approved request
    const cancelRes = await cancelBorrowRequest({
      requestId: newReq.id,
      userId: testUser.id,
    });

    assert.equal(cancelRes.status, "Cancelled");

    // Copy is released back to Available
    const refreshedCopy = await BookCopy.findByPk(secondCopy.copy_id);
    assert.equal(refreshedCopy.status, "Available");

    // Clean up second copy & its borrow record
    await BorrowedBook.destroy({ where: { copy_id: secondCopy.copy_id } });
    await BorrowRequest.destroy({ where: { request_id: newReq.id } });
    await secondCopy.destroy();
  });

  it("6b. Staff rejects pending borrow request and records reason", async () => {
    const rejectCopy = await BookCopy.create({
      book_id: testBook.book_id,
      accession_no: `ACC-${uniqueSuffix}-REJECT`,
      status: "Available",
      condition_status: "Good",
    });

    const rejectReq = await createBorrowRequest({
      userId: testUser.id,
      bookId: testBook.book_id,
      requestedDays: 7,
    });

    const rejectRes = await reviewBorrowRequest({
      requestId: rejectReq.id,
      reviewerId: staffUser.id,
      decision: "reject",
      remarks: "Title undergoing inventory audit",
    });

    assert.equal(rejectRes.status, "Rejected");
    assert.equal(rejectRes.remarks, "Title undergoing inventory audit");

    const inDb = await BorrowRequest.findByPk(rejectReq.id);
    assert.equal(inDb.status, "Rejected");
    assert.equal(inDb.remarks, "Title undergoing inventory audit");

    // Clean up
    await BorrowedBook.destroy({ where: { request_id: rejectReq.id } });
    await BorrowRequest.destroy({ where: { request_id: rejectReq.id } });
    await rejectCopy.destroy();
  });

  it("6c. Staff confirms pickup handover using requestId (claimHandover)", async () => {
    // Create copy & request
    const claimCopy = await BookCopy.create({
      book_id: testBook.book_id,
      accession_no: `ACC-${uniqueSuffix}-CLAIM`,
      status: "Available",
      condition_status: "Good",
    });

    const req = await createBorrowRequest({
      userId: testUser.id,
      bookId: testBook.book_id,
      requestedDays: 7,
    });

    await reviewBorrowRequest({
      requestId: req.id,
      reviewerId: staffUser.id,
      decision: "approve",
      copyId: claimCopy.copy_id,
    });

    // Confirm handover by requestId
    const claimRes = await pickupBook({
      requestId: req.id,
      issuerId: staffUser.id,
    });

    assert.equal(claimRes.status, "Borrowed");
    assert.equal(claimRes.requestId, req.id);

    const refreshedCopy = await BookCopy.findByPk(claimCopy.copy_id);
    assert.equal(refreshedCopy.status, "Borrowed");

    // Clean up
    await BorrowedBook.destroy({ where: { copy_id: claimCopy.copy_id } });
    await BorrowRequest.destroy({ where: { request_id: req.id } });
    await claimCopy.destroy();
  });

  it("6d. Staff rejects pickup handover (rejectHandover) and releases reserved copy back to Available", async () => {
    const handoverCopy = await BookCopy.create({
      book_id: testBook.book_id,
      accession_no: `ACC-${uniqueSuffix}-HANDOVER`,
      status: "Available",
      condition_status: "Good",
    });

    const req = await createBorrowRequest({
      userId: testUser.id,
      bookId: testBook.book_id,
      requestedDays: 7,
    });

    await reviewBorrowRequest({
      requestId: req.id,
      reviewerId: staffUser.id,
      decision: "approve",
      copyId: handoverCopy.copy_id,
    });

    // Verify copy is Reserved before rejection
    let copyInDb = await BookCopy.findByPk(handoverCopy.copy_id);
    assert.equal(copyInDb.status, "Reserved");

    // Staff rejects the pickup handover
    const rejectHandoverRes = await rejectPickupBook({
      requestId: req.id,
      staffId: staffUser.id,
      remarks: "Student presented invalid physical ID",
      reasonCode: "STUDENT_NOT_PRESENT",
    });

    assert.equal(rejectHandoverRes.status, "Rejected");
    assert.equal(rejectHandoverRes.copyStatus, "Available");
    assert.match(rejectHandoverRes.remarks, /Student presented invalid physical ID/);

    // Verify copy is restored to Available in DB
    copyInDb = await BookCopy.findByPk(handoverCopy.copy_id);
    assert.equal(copyInDb.status, "Available");

    // Verify loan is Cancelled in DB
    const loanInDb = await BorrowedBook.findOne({ where: { copy_id: handoverCopy.copy_id } });
    assert.equal(loanInDb.status, "Cancelled");

    // Clean up
    await BorrowedBook.destroy({ where: { copy_id: handoverCopy.copy_id } });
    await BorrowRequest.destroy({ where: { request_id: req.id } });
    await handoverCopy.destroy();
  });

  it("7. listBooks returns enriched books matching frontend BookSummary format", async () => {
    const result = await listBooks({ search: testBook.title, page: 1, limit: 10 });
    assert.ok(result.books.length >= 1);
    const found = result.books.find((b) => b.id === testBook.book_id);
    assert.ok(found);
    assert.equal(found.title, testBook.title);
    assert.ok(found.availability);
    assert.ok(found.author);
    assert.ok(Array.isArray(found.authors));
    assert.ok(result.pagination);
    assert.equal(result.pagination.page, 1);
  });

  it("8. getBookDetails returns specific book matching frontend BookDetail format", async () => {
    const book = await getBookDetails(testBook.book_id);
    assert.ok(book);
    assert.equal(book.id, testBook.book_id);
    assert.equal(book.bookId, testBook.book_id);
    assert.equal(book.title, testBook.title);
    assert.equal(book.isbn, testBook.isbn);
    assert.ok(book.availability);
    assert.ok(book.author);
    assert.ok(Array.isArray(book.authors));
    assert.equal(book.isArchived, false);
  });

  it("9. getTopBorrowedBooks returns top books matching frontend PopularBook format", async () => {
    const topBooks = await getTopBorrowedBooks(10);
    assert.ok(Array.isArray(topBooks));
    if (topBooks.length > 0) {
      const top = topBooks[0];
      assert.ok(top.bookId !== undefined);
      assert.ok(top.title !== undefined);
      assert.ok(top.loanCount !== undefined);
      assert.ok(top.availability !== undefined);
    }
  });

  it("10. Rejection flag: blocks request with message when no copies are available", async () => {
    const emptyBook = await Book.create({
      title: `Empty Book ${uniqueSuffix}`,
      author_id: testBook.author_id,
      category_id: testBook.category_id,
      isbn: `EMPTY-${Date.now()}`,
      status: "Active",
    });

    try {
      await assert.rejects(
        () => createBorrowRequest({
          userId: testUser.id,
          bookId: emptyBook.book_id,
          requestedDays: 7,
        }),
        (err) => {
          assert.equal(err.code, "NO_COPY_AVAILABLE");
          assert.equal(err.message, "Borrow request rejected: No copies are currently available for this book.");
          return true;
        }
      );
    } finally {
      await emptyBook.destroy();
    }
  });

  it("11. Rejection flag: blocks request with message when max copies per title is reached", async () => {
    // Current testUser has 1 borrowed book of testBook.
    // Create copy and request to reach limit of 2
    const secondCopy = await BookCopy.create({
      book_id: testBook.book_id,
      accession_no: `ACC-${uniqueSuffix}-LIMIT-2`,
      status: "Available",
      condition_status: "Good",
    });

    const secondReq = await createBorrowRequest({
      userId: testUser.id,
      bookId: testBook.book_id,
      requestedDays: 7,
    });

    // Create a 3rd copy in inventory
    const thirdCopy = await BookCopy.create({
      book_id: testBook.book_id,
      accession_no: `ACC-${uniqueSuffix}-LIMIT-3`,
      status: "Available",
      condition_status: "Good",
    });

    try {
      // 3rd request should fail because MAX_COPIES_PER_BOOK (2) is reached
      await assert.rejects(
        () => createBorrowRequest({
          userId: testUser.id,
          bookId: testBook.book_id,
          requestedDays: 7,
        }),
        (err) => {
          assert.equal(err.code, "MAX_COPIES_PER_BOOK_EXCEEDED");
          assert.ok(err.message.includes("maximum allowed limit of 2 copy/copies for this title"));
          return true;
        }
      );
    } finally {
      await BorrowedBook.destroy({ where: { request_id: secondReq.id } });
      await BorrowRequest.destroy({ where: { request_id: secondReq.id } });
      await secondCopy.destroy();
      await thirdCopy.destroy();
    }
  });

  it("12. Rejection flag: blocks request with message when student account or COR is not eligible", async () => {
    const unverifiedUser = await User.create({
      email: `unverified_${uniqueSuffix}@wmsu.edu.ph`,
      password_hash: "hash",
      role: "Student",
      status: "Active",
      first_name: "Unverified",
      last_name: "Student",
    });

    const tempCopy = await BookCopy.create({
      book_id: testBook.book_id,
      accession_no: `ACC-${uniqueSuffix}-TEMP-COR`,
      status: "Available",
      condition_status: "Good",
    });

    try {
      await assert.rejects(
        () => createBorrowRequest({
          userId: unverifiedUser.id,
          bookId: testBook.book_id,
          requestedDays: 7,
        }),
        (err) => {
          assert.equal(err.code, "VERIFICATION_REQUIRED");
          assert.ok(err.message.startsWith("Borrow request rejected:"));
          return true;
        }
      );
    } finally {
      await tempCopy.destroy();
      await unverifiedUser.destroy();
    }
  });

  after(async () => {
    try {
      if (testBook) {
        const copies = await BookCopy.findAll({ where: { book_id: testBook.book_id } });
        const copyIds = copies.map((c) => c.copy_id);
        if (copyIds.length > 0) {
          await BorrowedBook.destroy({ where: { copy_id: copyIds } });
        }
      }
      if (testUser) {
        const reqs = await BorrowRequest.findAll({ where: { user_id: testUser.id } });
        const reqIds = reqs.map((r) => r.request_id);
        if (reqIds.length > 0) {
          await BorrowedBook.destroy({ where: { request_id: reqIds } });
          await BorrowRequest.destroy({ where: { request_id: reqIds } });
        }
      }
      if (testVerification) await testVerification.destroy();
      if (testStudent) await testStudent.destroy();
      if (testUser) await testUser.destroy();
      if (staffUser) await staffUser.destroy();
      if (testCopy) await testCopy.destroy();
      if (testBook) {
        await BookCopy.destroy({ where: { book_id: testBook.book_id } });
        await testBook.destroy();
      }
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  });
});
