// Server/services/returnService.js
import { Op } from "sequelize";
import {
  Author,
  Book,
  BookCopy,
  BorrowedBook,
  BorrowRequest,
  Penalty,
  Reservation,
  ReturnedBook,
  Student,
  User,
  sequelize,
} from "../models/index.js";
import withActor from "../utils/withActor.js";
import { BorrowFlowError } from "./borrowFlowService.js";
import { createNotification } from "./notificationService.js";
import { processNextInReservationQueue } from "./reservationService.js";

const VALID_CONDITIONS = ["NEW", "GOOD", "FAIR", "DAMAGED", "UNUSABLE"];

function normalizeCondition(condition) {
  const upper = String(condition || "GOOD").trim().toUpperCase();
  if (!VALID_CONDITIONS.includes(upper)) {
    throw new BorrowFlowError(
      422,
      "VALIDATION_ERROR",
      `Invalid condition: "${condition}". Allowed conditions are: ${VALID_CONDITIONS.join(", ")}.`,
    );
  }
  return upper;
}

function calculateOverdueDays(dueDateVal, asOfDate = new Date()) {
  if (!dueDateVal) return 0;
  const due = new Date(dueDateVal);
  due.setHours(0, 0, 0, 0);
  const now = new Date(asOfDate);
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
}

/**
 * Format a staff loan details object matching client specifications
 */
export function formatStaffLoan(loan) {
  const req = loan.request;
  const student = req?.student;
  const user = student?.user;
  const book = loan.book;
  const copy = loan.copy;
  const returnRec = loan.returnRecord;
  const penalties = loan.penalties || [];

  const dueAt = loan.due_date ? String(loan.due_date) : null;
  const overdueDays = loan.status === "Borrowed" && dueAt ? calculateOverdueDays(dueAt) : (returnRec?.days_overdue || 0);

  return {
    id: String(loan.borrow_id),
    borrowId: String(loan.borrow_id),
    requestId: loan.request_id ? String(loan.request_id) : null,
    status: loan.status,
    borrowedAt: loan.borrow_date ? new Date(loan.borrow_date).toISOString() : null,
    dueAt: dueAt,
    returnedAt: returnRec?.return_date ? new Date(returnRec.return_date).toISOString() : null,
    overdueDays,
    book: book
      ? {
          id: String(book.book_id),
          title: book.title,
          isbn: book.isbn,
          coverImageUrl: book.cover_image || null,
          author: book.author
            ? `${book.author.first_name || ""} ${book.author.last_name || ""}`.trim()
            : null,
        }
      : null,
    copy: copy
      ? {
          id: String(copy.copy_id),
          accessionNo: copy.accession_no,
          barcode: copy.accession_no,
          shelfLocation: copy.shelf_location,
          conditionStatus: copy.condition_status,
          status: copy.status,
        }
      : null,
    student: student
      ? {
          id: String(student.user_id),
          userId: String(student.user_id),
          studentNumber: student.student_number || "",
          firstName: user?.first_name || "",
          lastName: user?.last_name || "",
          name: user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : "",
          email: user?.email || null,
          college: student.college || null,
          course: student.course || null,
          yearLevel: student.year_level != null ? Number(student.year_level) : null,
        }
      : null,
    returnRecord: returnRec
      ? {
          id: String(returnRec.return_id),
          returnId: String(returnRec.return_id),
          returnDate: new Date(returnRec.return_date).toISOString(),
          conditionStatus: returnRec.condition_status,
          daysOverdue: Number(returnRec.days_overdue || 0),
          receivedBy: String(returnRec.received_by),
          receiver: returnRec.receiver
            ? {
                id: String(returnRec.receiver.user_id),
                name: `${returnRec.receiver.first_name || ""} ${returnRec.receiver.last_name || ""}`.trim(),
                email: returnRec.receiver.email,
              }
            : null,
          remarks: returnRec.remarks || null,
        }
      : null,
    penalties: penalties.map((p) => ({
      id: String(p.penalty_id),
      penaltyId: String(p.penalty_id),
      penaltyType: p.penalty_type,
      amount: Number(p.amount || 0),
      status: p.status,
      reason: p.reason,
      createdAt: p.created_at ? new Date(p.created_at).toISOString() : null,
    })),
  };
}

/**
 * Fetch full details of a specific staff loan
 */
export async function getStaffLoanDetails(borrowId) {
  const loan = await BorrowedBook.findByPk(borrowId, {
    include: [
      {
        model: BorrowRequest,
        as: "request",
        include: [
          {
            model: Student,
            as: "student",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["user_id", "first_name", "last_name", "email"],
              },
            ],
          },
        ],
      },
      {
        model: Book,
        as: "book",
        include: [
          {
            model: Author,
            as: "author",
            attributes: ["author_id", "first_name", "last_name"],
          },
        ],
      },
      {
        model: BookCopy,
        as: "copy",
      },
      {
        model: ReturnedBook,
        as: "returnRecord",
        include: [
          {
            model: User,
            as: "receiver",
            attributes: ["user_id", "first_name", "last_name", "email"],
          },
        ],
      },
      {
        model: Penalty,
        as: "penalties",
      },
    ],
  });

  if (!loan) {
    throw new BorrowFlowError(404, "LOAN_NOT_FOUND", "Borrowed book loan record not found.");
  }

  return formatStaffLoan(loan);
}

/**
 * Accept / Receive book return
 * Transitions:
 * - borrowed_books: 'Borrowed' -> 'Returned'
 * - creates returned_books record
 * - updates book_copies status & condition:
 *   - NEW/GOOD/FAIR -> 'Available', condition 'Good' (or 'Fair'), triggers reservation auto-dispatch
 *   - DAMAGED -> 'Maintenance', condition 'Damaged'
 *   - UNUSABLE -> 'Withdrawn', condition 'Unusable'
 * - optional damage penalty assessment
 * - student notification & audit log
 */
export async function returnBorrowedBook({
  borrowId,
  staffId,
  condition = "GOOD",
  notes = null,
  fineType = null,
  fineAmount = null,
}) {
  const normalizedCond = normalizeCondition(condition);

  let bookIdForReservation = null;
  let copyIdReturned = null;
  let createdReturnId = null;
  let studentUserIdToNotify = null;
  let bookTitleForNotice = "";
  let resultingCopyStatus = "Available";
  let assessedPenalty = null;

  await withActor(staffId, async (transaction) => {
    const loan = await BorrowedBook.findByPk(borrowId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!loan) {
      throw new BorrowFlowError(404, "LOAN_NOT_FOUND", "Borrowed book loan record not found.");
    }

    const request = await BorrowRequest.findByPk(loan.request_id, {
      transaction,
      attributes: ["request_id", "user_id"],
    });

    const book = await Book.findByPk(loan.book_id, {
      transaction,
      attributes: ["book_id", "title"],
    });

    if (loan.status === "Returned") {
      throw new BorrowFlowError(409, "INVALID_STATE", "This loan is already returned and closed.");
    }

    if (loan.status === "Lost") {
      throw new BorrowFlowError(409, "INVALID_STATE", "This loan is marked as lost and cannot be returned directly.");
    }

    if (loan.status !== "Borrowed") {
      throw new BorrowFlowError(
        409,
        "INVALID_STATE",
        `Cannot accept return for a loan with status '${loan.status}'. Only active loans in 'Borrowed' status can be returned.`,
      );
    }

    const copy = await BookCopy.findByPk(loan.copy_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!copy) {
      throw new BorrowFlowError(404, "COPY_NOT_FOUND", "The assigned book copy record was not found.");
    }

    bookIdForReservation = loan.book_id;
    copyIdReturned = copy.copy_id;
    studentUserIdToNotify = request?.user_id;
    bookTitleForNotice = book?.title || "your borrowed book";

    const now = new Date();
    const daysOverdue = calculateOverdueDays(loan.due_date, now);

    // Map condition to db constraint:
    // returned_books.condition_status accepts: 'Good', 'Damaged', 'Lost'
    // book_copies.condition_status accepts: 'Good', 'Damaged'
    // book_copies.status accepts: 'Available', 'Reserved', 'Borrowed', 'Maintenance', 'Lost'
    let dbConditionStatus = "Good";
    if (normalizedCond === "DAMAGED" || normalizedCond === "UNUSABLE") {
      dbConditionStatus = "Damaged";
    }

    // Create ReturnedBook entry
    const returnRecord = await ReturnedBook.create(
      {
        borrow_id: loan.borrow_id,
        return_date: now,
        condition_status: dbConditionStatus,
        days_overdue: daysOverdue,
        received_by: staffId,
        remarks: notes?.trim() || null,
      },
      { transaction },
    );
    createdReturnId = returnRecord.return_id;

    // Update BorrowedBook status
    await loan.update({ status: "Returned" }, { transaction });

    // Update Copy status based on condition
    if (normalizedCond === "DAMAGED" || normalizedCond === "UNUSABLE") {
      resultingCopyStatus = "Maintenance";
      await copy.update(
        {
          status: "Maintenance",
          condition_status: "Damaged",
        },
        { transaction },
      );
    } else {
      resultingCopyStatus = "Available";
      await copy.update(
        {
          status: "Available",
          condition_status: "Good",
        },
        { transaction },
      );
    }

    // Optional damage penalty creation
    if ((normalizedCond === "DAMAGED" || normalizedCond === "UNUSABLE") && (fineType || fineAmount)) {
      const penaltyAmount = Number(fineAmount) > 0 ? Number(fineAmount) : fineType === "DAMAGE_MAJOR" ? 200 : 100;
      const penaltyRecord = await Penalty.create(
        {
          borrow_id: loan.borrow_id,
          return_id: returnRecord.return_id,
          penalty_type: "Damaged Book",
          reason: notes?.trim() || `Book returned in damaged condition (${fineType || "DAMAGE_MINOR"}).`,
          amount: penaltyAmount,
          status: "Unpaid",
          created_by: staffId,
        },
        { transaction },
      );
      assessedPenalty = {
        id: String(penaltyRecord.penalty_id),
        fineType: penaltyRecord.penalty_type,
        amount: Number(penaltyRecord.amount),
        status: penaltyRecord.status,
        reason: penaltyRecord.reason,
      };
    }
  });

  // After transaction commits: if copy was restored to Available, trigger reservation FIFO auto-dispatch
  let offeredToReservationId = null;
  if (resultingCopyStatus === "Available" && bookIdForReservation) {
    try {
      const dispatched = await processNextInReservationQueue(bookIdForReservation);
      if (dispatched?.reservationId) {
        offeredToReservationId = String(dispatched.reservationId);
      }
    } catch (queueErr) {
      console.warn("[Reservation Dispatch on Return Error]:", queueErr.message);
    }
  }

  // Notify student
  if (studentUserIdToNotify) {
    try {
      await createNotification({
        userId: studentUserIdToNotify,
        type: "LOAN_RETURNED",
        title: "Book returned",
        message: `Your return of "${bookTitleForNotice}" was successfully processed.`,
        relatedEntityType: "LOAN",
        relatedEntityId: String(borrowId),
      });
    } catch (notifErr) {
      console.warn("[Notification Error on Return]:", notifErr.message);
    }
  }

  // Fetch updated loan details
  const updatedLoan = await getStaffLoanDetails(borrowId);

  return {
    message: "Book return processed successfully.",
    loan: updatedLoan,
    copyStatus: resultingCopyStatus.toUpperCase(),
    offeredToReservationId,
    penalty: assessedPenalty,
  };
}

/**
 * Mark a loan as lost (by staff or self-reported by student).
 * Standard ₱500 lost book penalty is assessed automatically.
 * Copy is updated to status='Lost', condition='Damaged'.
 */
export async function markBorrowedBookLost({ borrowId, staffId, actorId, actorRole, notes = null }) {
  const effectiveActorId = actorId || staffId;
  let createdPenalty = null;
  let studentUserIdToNotify = null;
  let bookTitleForNotice = "";
  const isStudentSelfReport = actorRole === "Student";

  await withActor(effectiveActorId, async (transaction) => {
    const loan = await BorrowedBook.findByPk(borrowId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!loan) {
      throw new BorrowFlowError(404, "LOAN_NOT_FOUND", "Borrowed book loan record not found.");
    }

    const request = await BorrowRequest.findByPk(loan.request_id, {
      transaction,
      attributes: ["request_id", "user_id"],
    });

    // If a Student reports the loss, verify they are the borrower of this book
    if (isStudentSelfReport && request?.user_id !== effectiveActorId) {
      throw new BorrowFlowError(403, "FORBIDDEN", "You can only report your own borrowed book as lost.");
    }

    const book = await Book.findByPk(loan.book_id, {
      transaction,
      attributes: ["book_id", "title"],
    });

    if (loan.status === "Lost") {
      throw new BorrowFlowError(409, "INVALID_STATE", "This loan has already been marked as lost.");
    }

    if (loan.status === "Returned") {
      throw new BorrowFlowError(409, "INVALID_STATE", "A returned loan cannot be marked as lost.");
    }

    if (loan.status !== "Borrowed") {
      throw new BorrowFlowError(
        409,
        "INVALID_STATE",
        `Only active loans in 'Borrowed' status can be marked lost. Current status is '${loan.status}'.`,
      );
    }

    const copy = await BookCopy.findByPk(loan.copy_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!copy) {
      throw new BorrowFlowError(404, "COPY_NOT_FOUND", "The assigned book copy record was not found.");
    }

    studentUserIdToNotify = request?.user_id;
    bookTitleForNotice = book?.title || "your borrowed book";

    // 1. Update loan to 'Lost'
    await loan.update({ status: "Lost" }, { transaction });

    // 2. Update copy to 'Lost' (chk_copy_condition allows 'Good' | 'Damaged')
    await copy.update(
      {
        status: "Lost",
        condition_status: "Damaged",
      },
      { transaction },
    );

    // 3. Create ₱500 standard lost book penalty automatically
    const defaultReason = isStudentSelfReport
      ? "Book self-reported as lost by the student."
      : "Book marked lost after confirming with the student.";
    const penaltyReason = notes?.trim()
      ? (isStudentSelfReport ? `Self-reported as lost: ${notes.trim()}` : notes.trim())
      : defaultReason;

    const penaltyRecord = await Penalty.create(
      {
        borrow_id: loan.borrow_id,
        return_id: null,
        penalty_type: "Lost Book",
        reason: penaltyReason,
        amount: 500.00,
        status: "Unpaid",
        created_by: effectiveActorId,
      },
      { transaction },
    );

    createdPenalty = {
      id: String(penaltyRecord.penalty_id),
      fineType: "LOST_BOOK",
      amount: 500,
      paidAmount: 0,
      balance: 500,
      status: "UNPAID",
      recordedAt: new Date(penaltyRecord.created_at).toISOString(),
      loanId: String(loan.borrow_id),
      bookTitle: bookTitleForNotice,
      notes: penaltyReason,
    };
  });

  // Notify student
  if (studentUserIdToNotify) {
    try {
      const notifTitle = isStudentSelfReport ? "Book reported as lost" : "Book marked as lost";
      const notifMsg = isStudentSelfReport
        ? `You self-reported "${bookTitleForNotice}" as lost. A standard ₱500.00 lost book replacement fine has been charged to your account.`
        : `"${bookTitleForNotice}" was marked as lost by library staff. A standard ₱500.00 lost book fine has been recorded to your account.`;

      await createNotification({
        userId: studentUserIdToNotify,
        type: "FINE_ASSESSED",
        title: notifTitle,
        message: notifMsg,
        relatedEntityType: "LOAN",
        relatedEntityId: String(borrowId),
      });
    } catch (notifErr) {
      console.warn("[Notification Error on Mark Lost]:", notifErr.message);
    }
  }

  // Fetch updated loan
  const updatedLoan = await getStaffLoanDetails(borrowId);

  return {
    message: "Loan marked as lost and ₱500 lost-book fine recorded.",
    loan: updatedLoan,
    penalty: createdPenalty,
  };
}
