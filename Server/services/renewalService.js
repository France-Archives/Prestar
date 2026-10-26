// Server/services/renewalService.js
import { Op } from "sequelize";
import {
  Book,
  BookCopy,
  BorrowedBook,
  BorrowRequest,
  Renewal,
  Reservation,
  Student,
  User,
  sequelize,
} from "../models/index.js";
import {
  MAX_ACTIVE_BORROWS,
  MAX_COPIES_PER_BOOK,
  MAX_REQUEST_DAYS,
  RENEWAL_LIMIT,
} from "../config/libraryRules.js";
import { checkBorrowEligibility } from "./borrowEligibilityService.js";
import withActor from "../utils/withActor.js";
import { createNotification } from "./notificationService.js";

export class RenewalError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = "RenewalError";
    this.status = status;
    this.code = code;
    this.reasons = extra.reasons || [];
    this.details = extra;
  }
}

/**
 * Request and process a renewal for an active loan.
 * Validates:
 * 1. Loan exists, belongs to the student (unless staff acting), and is in "Borrowed" status.
 * 2. Renewal duration is valid (1 to MAX_REQUEST_DAYS).
 * 3. Student borrow eligibility flags (Active account, Active suspension, Active term, Approved COR, Unpaid penalties).
 * 4. Renewal limit per loan (max RENEWAL_LIMIT).
 * 5. Reservation queue: Rejected if another student is waiting for the same book (Waiting or Ready).
 * 6. Limits: MAX_COPIES_PER_BOOK and MAX_ACTIVE_BORROWS.
 */
export async function createRenewal({ loanId, userId, requestedDurationDays = 7, userRole = "Student" }) {
  const loan = await BorrowedBook.findByPk(loanId, {
    include: [
      {
        model: BorrowRequest,
        as: "request",
        include: [
          {
            model: Student,
            as: "student",
            include: [{ model: User, as: "user" }],
          },
        ],
      },
      {
        model: Book,
        as: "book",
      },
      {
        model: BookCopy,
        as: "copy",
      },
      {
        model: Renewal,
        as: "renewals",
      },
    ],
  });

  if (!loan) {
    throw new RenewalError(404, "NOT_FOUND", "We could not find that loan.");
  }

  const borrowerUserId = loan.request?.user_id;

  // Authorization: if Student, must own the loan
  if (userRole === "Student" && String(borrowerUserId) !== String(userId)) {
    throw new RenewalError(404, "NOT_FOUND", "We could not find that loan.");
  }

  // 1. Only active loans (status: 'Borrowed') can be renewed
  if (loan.status !== "Borrowed") {
    throw new RenewalError(409, "INVALID_STATE", "Only active loans can be renewed.");
  }

  // 2. Validate duration
  const duration = Number(requestedDurationDays);
  if (!Number.isInteger(duration) || duration < 1 || duration > MAX_REQUEST_DAYS) {
    throw new RenewalError(
      422,
      "INVALID_DURATION",
      `Requested duration must be an integer between 1 and ${MAX_REQUEST_DAYS} days.`,
    );
  }

  // 3. Flags: Account active, Active suspension, Active term, COR verification, Unpaid penalties
  const eligibility = await checkBorrowEligibility(borrowerUserId);
  if (!eligibility.eligible) {
    const primaryReason = eligibility.reasons[0];
    const reasonMsg = primaryReason?.message || "Student is not eligible to renew.";
    throw new RenewalError(
      403,
      primaryReason?.code || "BORROW_INELIGIBLE",
      `Renewal rejected: ${reasonMsg}`,
      { reasons: eligibility.reasons },
    );
  }

  // 4. Renewal limit check (default: 1 renewal per loan)
  const approvedRenewalsCount = (loan.renewals || []).filter(
    (r) => r.renewal_status === "Approved",
  ).length;

  if (approvedRenewalsCount >= RENEWAL_LIMIT) {
    throw new RenewalError(
      403,
      "RENEWAL_LIMIT_REACHED",
      `This loan has reached its maximum renewal limit of ${RENEWAL_LIMIT}.`,
    );
  }

  // 5. Check reservation queue for this title
  const bookId = loan.book_id;
  const queuedReservation = await Reservation.findOne({
    where: {
      book_id: bookId,
      status: { [Op.in]: ["Waiting", "Ready"] },
    },
  });

  const now = new Date();
  const oldDueDate = loan.due_date;
  const newDueDateObj = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
  const newDueDateStr = newDueDateObj.toISOString().slice(0, 10);

  if (queuedReservation) {
    // Record rejected renewal in DB and notify student
    const rejectedRenewal = await Renewal.create({
      borrow_id: loan.borrow_id,
      requested_at: now,
      old_due_date: oldDueDate || now.toISOString().slice(0, 10),
      requested_duration_days: duration,
      requested_due_date: newDueDateStr,
      renewal_status: "Rejected",
      reviewed_by: null,
      reviewed_at: now,
      new_due_date: null,
      remarks: "Another student is waiting for this title.",
    });

    try {
      await createNotification({
        userId: borrowerUserId,
        type: "RENEWAL_REJECTED",
        title: "Renewal not approved",
        message: `Your renewal for ${loan.book?.title || "your book"} was not approved: Another student is waiting for this title.`,
        relatedEntityType: "LOAN",
        relatedEntityId: loan.borrow_id,
      });
    } catch (notifErr) {
      console.warn("Could not dispatch renewal rejection notification:", notifErr.message);
    }

    return {
      id: String(rejectedRenewal.renewal_id),
      loanId: String(loan.borrow_id),
      bookTitle: loan.book?.title || "",
      requestedDurationDays: duration,
      status: "REJECTED",
      requestedAt: rejectedRenewal.requested_at.toISOString(),
      approvedAt: null,
      oldDueAt: oldDueDate ? new Date(oldDueDate).toISOString() : null,
      newDueAt: null,
      decisionReason: "Another student is waiting for this title.",
    };
  }

  // 6. Limits: Check max active loans & max copies per book for this student
  const activeLoansForBook = await BorrowedBook.count({
    where: {
      book_id: bookId,
      status: { [Op.in]: ["Reserved", "Borrowed"] },
    },
    include: [
      {
        model: BorrowRequest,
        as: "request",
        where: { user_id: borrowerUserId },
        required: true,
      },
    ],
  });

  if (activeLoansForBook > MAX_COPIES_PER_BOOK) {
    throw new RenewalError(
      409,
      "MAX_COPIES_PER_BOOK_EXCEEDED",
      `Renewal rejected: You exceed the maximum allowed limit of ${MAX_COPIES_PER_BOOK} copy/copies for this title.`,
    );
  }

  const totalActiveLoans = await BorrowedBook.count({
    where: {
      status: { [Op.in]: ["Reserved", "Borrowed"] },
    },
    include: [
      {
        model: BorrowRequest,
        as: "request",
        where: { user_id: borrowerUserId },
        required: true,
      },
    ],
  });

  if (totalActiveLoans > MAX_ACTIVE_BORROWS) {
    throw new RenewalError(
      409,
      "MAX_ACTIVE_BORROWS_EXCEEDED",
      `Renewal rejected: You exceed the maximum allowed limit of ${MAX_ACTIVE_BORROWS} active book loans/requests.`,
    );
  }

  // 7. Approve Renewal in a transaction
  return await withActor(userId, async (transaction) => {
    await loan.update(
      {
        due_date: newDueDateStr,
      },
      { transaction },
    );

    const renewalRecord = await Renewal.create(
      {
        borrow_id: loan.borrow_id,
        requested_at: now,
        old_due_date: oldDueDate || now.toISOString().slice(0, 10),
        requested_duration_days: duration,
        requested_due_date: newDueDateStr,
        renewal_status: "Approved",
        reviewed_by: null,
        reviewed_at: now,
        new_due_date: newDueDateStr,
        remarks: "Automatically approved by system.",
      },
      { transaction },
    );

    try {
      await createNotification({
        userId: borrowerUserId,
        type: "RENEWAL_APPROVED",
        title: "Renewal approved",
        message: `Your renewal for ${loan.book?.title || "your book"} was approved. New due date: ${newDueDateStr}.`,
        relatedEntityType: "LOAN",
        relatedEntityId: loan.borrow_id,
        transaction,
      });
    } catch (notifErr) {
      console.warn("Could not dispatch renewal approval notification:", notifErr.message);
    }

    return {
      id: String(renewalRecord.renewal_id),
      loanId: String(loan.borrow_id),
      bookTitle: loan.book?.title || "",
      requestedDurationDays: duration,
      status: "APPROVED",
      requestedAt: renewalRecord.requested_at.toISOString(),
      approvedAt: renewalRecord.reviewed_at.toISOString(),
      oldDueAt: oldDueDate ? new Date(oldDueDate).toISOString() : null,
      newDueAt: new Date(newDueDateStr).toISOString(),
      decisionReason: null,
    };
  });
}

/**
 * List renewal history for the current student.
 */
export async function listMyRenewals(userId) {
  if (!userId) {
    return [];
  }
  const renewals = await Renewal.findAll({
    include: [
      {
        model: BorrowedBook,
        as: "borrow",
        required: true,
        include: [
          {
            model: BorrowRequest,
            as: "request",
            where: { user_id: userId },
            required: true,
          },
          {
            model: Book,
            as: "book",
            attributes: ["book_id", "title"],
          },
        ],
      },
    ],
    order: [["requested_at", "DESC"]],
  });

  return renewals.map((r) => formatRenewalView(r));
}

/**
 * List renewals for a specific loan (accessible by loan owner or staff).
 */
export async function listLoanRenewals(loanId, user) {
  const loan = await BorrowedBook.findByPk(loanId, {
    include: [{ model: BorrowRequest, as: "request" }],
  });

  if (!loan) {
    throw new RenewalError(404, "NOT_FOUND", "We could not find that loan.");
  }

  const isStaff = user?.role === "Admin" || user?.role === "Librarian";
  const currentUserId = user?.id ?? user?.user_id;
  if (!isStaff && String(loan.request?.user_id) !== String(currentUserId)) {
    throw new RenewalError(404, "NOT_FOUND", "We could not find that loan.");
  }

  const renewals = await Renewal.findAll({
    where: { borrow_id: loanId },
    include: [
      {
        model: BorrowedBook,
        as: "borrow",
        include: [
          {
            model: Book,
            as: "book",
            attributes: ["book_id", "title"],
          },
        ],
      },
    ],
    order: [["requested_at", "DESC"]],
  });

  return renewals.map((r) => formatRenewalView(r));
}

/**
 * List all renewals for staff/librarian view, with student details and search.
 */
export async function listStaffRenewals({ search = "" } = {}) {
  const whereConditions = [];

  const renewals = await Renewal.findAll({
    include: [
      {
        model: BorrowedBook,
        as: "borrow",
        required: true,
        include: [
          {
            model: BorrowRequest,
            as: "request",
            required: true,
            include: [
              {
                model: Student,
                as: "student",
                include: [{ model: User, as: "user" }],
              },
            ],
          },
          {
            model: Book,
            as: "book",
            attributes: ["book_id", "title"],
          },
        ],
      },
    ],
    order: [["requested_at", "DESC"]],
  });

  const formatted = renewals.map((r) => {
    const studentUser = r.borrow?.request?.student?.user;
    const studentProfile = r.borrow?.request?.student;

    return {
      ...formatRenewalView(r),
      student: {
        id: String(studentProfile?.student_id || ""),
        userId: String(studentUser?.user_id || ""),
        firstName: studentUser?.first_name || "",
        lastName: studentUser?.last_name || "",
        studentNumber: studentProfile?.student_number || "",
        college: studentProfile?.college || "",
        program: studentProfile?.program || "",
      },
    };
  });

  if (!search || !search.trim()) {
    return formatted;
  }

  const term = search.trim().toLowerCase();
  return formatted.filter(
    (item) =>
      item.bookTitle?.toLowerCase().includes(term) ||
      item.student?.firstName?.toLowerCase().includes(term) ||
      item.student?.lastName?.toLowerCase().includes(term) ||
      item.student?.studentNumber?.toLowerCase().includes(term),
  );
}

function safeIsoDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function formatRenewalView(r) {
  const statusMap = {
    Approved: "APPROVED",
    Rejected: "REJECTED",
    Pending: "PENDING",
  };

  return {
    id: String(r.renewal_id),
    loanId: String(r.borrow_id),
    bookTitle: r.borrow?.book?.title || "",
    requestedDurationDays: r.requested_duration_days,
    status: statusMap[r.renewal_status] || r.renewal_status,
    requestedAt: safeIsoDate(r.requested_at) || new Date().toISOString(),
    approvedAt: safeIsoDate(r.reviewed_at),
    oldDueAt: safeIsoDate(r.old_due_date),
    newDueAt: safeIsoDate(r.new_due_date),
    decisionReason: r.renewal_status === "Rejected" ? r.remarks : null,
  };
}
