// Server/tests/reservationQueueFlow.test.js
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
  Reservation,
  Student,
  StudentVerification,
  User,
  sequelize,
} from "../models/index.js";
import {
  createReservation,
  listMyReservations,
  cancelReservation,
  processNextInReservationQueue,
  ReservationError,
} from "../services/reservationService.js";

describe("Reservation FIFO Queue & Dual-Checkpoint Flag Enforcement Test Suite", () => {
  const uniqueSuffix = Date.now();
  let category;
  let author;
  let activeTerm;
  let testBookZeroCopies;
  let eligibleStudent1;
  let eligibleStudent2;
  let flaggedStudent;

  before(async () => {
    // 1. Setup category, author, active term
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

    // 2. Setup Book with 0 copies (out of stock)
    testBookZeroCopies = await Book.create({
      title: `Algorithms & Data Structures ${uniqueSuffix}`,
      author_id: author.author_id,
      category_id: category.category_id,
      isbn: `RES-${String(uniqueSuffix).slice(-10)}`,
      status: "Active",
    });

    // 2b. Find or create staff user for review
    const { Op } = await import("sequelize");
    let staffUser = await User.findOne({
      where: { role: { [Op.in]: ["Admin", "Librarian"] }, status: "Active" },
    });
    if (!staffUser) {
      staffUser = await User.create({
        email: `staff_${uniqueSuffix}@wmsu.edu.ph`,
        password_hash: "hash",
        role: "Librarian",
        status: "Active",
        first_name: "Staff",
        last_name: "Test",
      });
    }

    // 3. Create eligibleStudent1 with approved verification
    eligibleStudent1 = await User.create({
      email: `res_student1_${uniqueSuffix}@wmsu.edu.ph`,
      password_hash: "hash",
      role: "Student",
      status: "Active",
      first_name: "Eligible1",
      last_name: "Student",
    });
    await Student.create({
      user_id: eligibleStudent1.user_id,
      student_number: `SN1-${String(uniqueSuffix).slice(-8)}`,
      course: "BSCS",
      year_level: 2,
    });
    await StudentVerification.create({
      user_id: eligibleStudent1.user_id,
      term_id: activeTerm.term_id,
      proof_file: Buffer.from("proof"),
      status: "Approved",
      reviewed_by: staffUser.user_id,
      reviewed_at: new Date(),
      valid_from: "2026-01-01",
      valid_until: "2026-12-31",
    });

    // 4. Create eligibleStudent2 with approved verification
    eligibleStudent2 = await User.create({
      email: `res_student2_${uniqueSuffix}@wmsu.edu.ph`,
      password_hash: "hash",
      role: "Student",
      status: "Active",
      first_name: "Eligible2",
      last_name: "Student",
    });
    await Student.create({
      user_id: eligibleStudent2.user_id,
      student_number: `SN2-${String(uniqueSuffix).slice(-8)}`,
      course: "BSCS",
      year_level: 3,
    });
    await StudentVerification.create({
      user_id: eligibleStudent2.user_id,
      term_id: activeTerm.term_id,
      proof_file: Buffer.from("proof"),
      status: "Approved",
      reviewed_by: staffUser.user_id,
      reviewed_at: new Date(),
      valid_from: "2026-01-01",
      valid_until: "2026-12-31",
    });

    // 5. Create flaggedStudent WITHOUT approved verification (unverified flag)
    flaggedStudent = await User.create({
      email: `flagged_student_${uniqueSuffix}@wmsu.edu.ph`,
      password_hash: "hash",
      role: "Student",
      status: "Active",
      first_name: "Flagged",
      last_name: "Student",
    });
    await Student.create({
      user_id: flaggedStudent.user_id,
      student_number: `SNF-${String(uniqueSuffix).slice(-8)}`,
      course: "BSCS",
      year_level: 1,
    });
  });

  after(async () => {
    try {
      const userIds = [eligibleStudent1?.user_id, eligibleStudent2?.user_id, flaggedStudent?.user_id].filter(Boolean);
      await Reservation.destroy({ where: { user_id: userIds } });
      await BorrowedBook.destroy({ where: { book_id: testBookZeroCopies.book_id } });
      await BorrowRequest.destroy({ where: { book_id: testBookZeroCopies.book_id } });
      await BookCopy.destroy({ where: { book_id: testBookZeroCopies.book_id } });
      await testBookZeroCopies.destroy();
      await StudentVerification.destroy({ where: { user_id: userIds } });
      await Student.destroy({ where: { user_id: userIds } });
      await User.destroy({ where: { user_id: userIds } });
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  });

  it("1. Checkpoint 1: Blocks reservation when a book already has an available copy", async () => {
    // Add 1 available copy to book
    const tempCopy = await BookCopy.create({
      book_id: testBookZeroCopies.book_id,
      accession_no: `ACC-AVAIL-${uniqueSuffix}`,
      status: "Available",
      condition_status: "Good",
    });

    try {
      await assert.rejects(
        () => createReservation({
          userId: eligibleStudent1.user_id,
          bookId: testBookZeroCopies.book_id,
        }),
        (err) => {
          assert.equal(err.code, "COPY_AVAILABLE");
          assert.ok(err.message.includes("available to borrow directly"));
          return true;
        }
      );
    } finally {
      await tempCopy.destroy();
    }
  });

  it("2. Checkpoint 1: Blocks student with flags from joining reservation queue", async () => {
    await assert.rejects(
      () => createReservation({
        userId: flaggedStudent.user_id,
        bookId: testBookZeroCopies.book_id,
      }),
      (err) => {
        assert.equal(err.code, "VERIFICATION_REQUIRED");
        assert.ok(err.message.startsWith("Reservation rejected:"));
        return true;
      }
    );
  });

  it("3. Checkpoint 1: Eligible students successfully join FIFO queue with queue positions", async () => {
    // Student 1 joins first
    const res1 = await createReservation({
      userId: eligibleStudent1.user_id,
      bookId: testBookZeroCopies.book_id,
      requestedDays: 7,
    });
    assert.equal(res1.status, "Waiting");
    assert.equal(res1.queuePosition, 1);

    // Student 2 joins second
    const res2 = await createReservation({
      userId: eligibleStudent2.user_id,
      bookId: testBookZeroCopies.book_id,
      requestedDays: 14,
    });
    assert.equal(res2.status, "Waiting");
    assert.equal(res2.queuePosition, 2);

    // Student lists their reservations
    const myList1 = await listMyReservations(eligibleStudent1.user_id);
    assert.equal(myList1.reservations.length, 1);
    assert.equal(myList1.reservations[0].queuePosition, 1);
    assert.equal(myList1.reservations[0].status, "Waiting");
  });

  it("4. Checkpoint 1: Blocks duplicate queue entry for the same title", async () => {
    await assert.rejects(
      () => createReservation({
        userId: eligibleStudent1.user_id,
        bookId: testBookZeroCopies.book_id,
      }),
      (err) => {
        assert.ok(err.message.includes("already in the reservation queue") || err.message.includes("limit of 2 per title"));
        return true;
      }
    );
  });

  it("5. Checkpoint 2: When copy becomes available, skips flagged student in queue and assigns to next eligible student", async () => {
    // Modify student 1 so they now have a flag (e.g. invalidate their verification while waiting)
    await StudentVerification.destroy({ where: { user_id: eligibleStudent1.user_id } });

    // Now a new copy of testBookZeroCopies suddenly arrives in inventory!
    const newCopy = await BookCopy.create({
      book_id: testBookZeroCopies.book_id,
      accession_no: `ACC-ARRIVED-${uniqueSuffix}`,
      status: "Available",
      condition_status: "Good",
    });

    // Trigger queue processor
    const result = await processNextInReservationQueue(testBookZeroCopies.book_id);
    assert.ok(result);
    assert.equal(result.assigned, true);
    // Student 1 was skipped due to missing COR flag; copy was assigned to Student 2!
    assert.equal(result.studentId, eligibleStudent2.user_id);
    assert.equal(result.copyId, newCopy.copy_id);

    // Verify Student 1's reservation was updated to 'Cancelled' with exact flag reason in remarks
    const student1Res = await Reservation.findOne({
      where: { user_id: eligibleStudent1.user_id, book_id: testBookZeroCopies.book_id },
    });
    assert.equal(student1Res.status, "Cancelled");
    assert.ok(student1Res.remarks.startsWith("Skipped:"));
    assert.ok(student1Res.remarks.includes("verification"));

    // Verify Student 2's reservation was updated to 'Ready'
    const student2Res = await Reservation.findOne({
      where: { user_id: eligibleStudent2.user_id, book_id: testBookZeroCopies.book_id },
    });
    assert.equal(student2Res.status, "Ready");
    assert.ok(student2Res.expires_at);

    // Verify copy is now 'Reserved'
    const refreshedCopy = await BookCopy.findByPk(newCopy.copy_id);
    assert.equal(refreshedCopy.status, "Reserved");

    // Verify row was created in borrowed_books
    const loan = await BorrowedBook.findOne({
      where: { copy_id: newCopy.copy_id, status: "Reserved" },
    });
    assert.ok(loan);
    assert.equal(loan.borrow_id, result.borrowId);
  });

  it("6. Student cancels reservation and releases reserved copy if Ready", async () => {
    const student2Res = await Reservation.findOne({
      where: { user_id: eligibleStudent2.user_id, book_id: testBookZeroCopies.book_id, status: "Ready" },
    });
    assert.ok(student2Res);

    const cancelRes = await cancelReservation({
      reservationId: student2Res.reservation_id,
      userId: eligibleStudent2.user_id,
    });
    assert.equal(cancelRes.status, "Cancelled");

    // Copy is released back to Available
    const copy = await BookCopy.findOne({ where: { book_id: testBookZeroCopies.book_id } });
    assert.equal(copy.status, "Available");
  });
});
