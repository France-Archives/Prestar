// Server/services/borrowFlowService.js
import { Op, QueryTypes, UniqueConstraintError } from "sequelize";
import {
  Author,
  Book,
  BookCopy,
  BorrowedBook,
  BorrowRequest,
  Student,
  User,
  AcademicTerm,
  StudentVerification,
  sequelize,
} from "../models/index.js";
import {
  MAX_ACTIVE_BORROWS,
  MAX_COPIES_PER_BOOK,
  MAX_REQUEST_DAYS,
  PICKUP_WINDOW_DAYS,
} from "../config/libraryRules.js";
import withActor from "../utils/withActor.js";
import { checkBorrowEligibility } from "./borrowEligibilityService.js";

export class BorrowFlowError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = "BorrowFlowError";
    this.status = status;
    this.code = code;
    this.reasons = extra.reasons || [];
    this.details = extra;
  }
}

/**
 * Step 5: If pickup_deadline passes without pickup:
 * request -> 'Expired', borrowed_books -> 'Cancelled', copy -> 'Available'.
 * Runs lazily with no actor user (session app.user_id unset).
 */
export async function expireStalePickups() {
  return withActor(null, async (transaction) => {
    const expiredRequests = await BorrowRequest.findAll({
      where: {
        status: "Approved",
        pickup_deadline: { [Op.lt]: new Date() },
      },
      attributes: ["request_id"],
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
    });

    if (expiredRequests.length === 0) return 0;

    for (const reqRow of expiredRequests) {
      const loan = await BorrowedBook.findOne({
        where: { request_id: reqRow.request_id, status: "Reserved" },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (loan) {
        await loan.update({ status: "Cancelled" }, { transaction });
        await BookCopy.update(
          { status: "Available" },
          { where: { copy_id: loan.copy_id }, transaction },
        );
      }

      await BorrowRequest.update(
        { status: "Expired" },
        { where: { request_id: reqRow.request_id }, fields: ["status"], transaction },
      );
    }

    return expiredRequests.length;
  });
}

/**
 * Step 1: Student creates a borrow request.
 */
export async function createBorrowRequest({ userId, bookId, requestedDays }) {
  const book = await Book.findOne({
    where: { book_id: bookId, status: "Active" },
    attributes: ["book_id", "title", "status"],
  });
  if (!book) {
    throw new BorrowFlowError(404, "BOOK_NOT_FOUND", "Active book not found.");
  }

  if (
    !Number.isInteger(requestedDays) ||
    requestedDays < 1 ||
    requestedDays > MAX_REQUEST_DAYS
  ) {
    throw new BorrowFlowError(
      400,
      "INVALID_REQUESTED_DAYS",
      `requested_days must be an integer between 1 and ${MAX_REQUEST_DAYS}.`,
    );
  }

  const availableCount = await BookCopy.count({
    where: {
      book_id: bookId,
      status: "Available",
      condition_status: "Good",
    },
  });
  if (availableCount === 0) {
    throw new BorrowFlowError(
      409,
      "NO_COPY_AVAILABLE",
      "No copies are currently available for this book.",
    );
  }

  const eligibility = await checkBorrowEligibility(userId);
  if (!eligibility.eligible) {
    throw new BorrowFlowError(
      403,
      "BORROW_INELIGIBLE",
      "Student is not eligible to borrow.",
      { reasons: eligibility.reasons },
    );
  }

  // Same-book limit: max MAX_COPIES_PER_BOOK active loans or open requests
  const openRequestsForBook = await BorrowRequest.count({
    where: {
      user_id: userId,
      book_id: bookId,
      status: { [Op.in]: ["Pending", "Approved"] },
    },
  });

  const activeLoansForBook = await BorrowedBook.count({
    where: {
      book_id: bookId,
      status: "Borrowed",
    },
    include: [
      {
        model: BorrowRequest,
        as: "request",
        where: { user_id: userId },
        required: true,
      },
    ],
  });

  if (openRequestsForBook + activeLoansForBook >= MAX_COPIES_PER_BOOK) {
    throw new BorrowFlowError(
      409,
      "MAX_COPIES_PER_BOOK_EXCEEDED",
      `You already have ${MAX_COPIES_PER_BOOK} active loan(s) or request(s) for this book, which is the maximum allowed per title.`,
    );
  }

  // Total active borrows limit: max MAX_ACTIVE_BORROWS
  const totalOpenRequests = await BorrowRequest.count({
    where: {
      user_id: userId,
      status: { [Op.in]: ["Pending", "Approved"] },
    },
  });

  const totalActiveLoans = await BorrowedBook.count({
    where: {
      status: "Borrowed",
    },
    include: [
      {
        model: BorrowRequest,
        as: "request",
        where: { user_id: userId },
        required: true,
      },
    ],
  });

  if (totalOpenRequests + totalActiveLoans >= MAX_ACTIVE_BORROWS) {
    throw new BorrowFlowError(
      409,
      "MAX_ACTIVE_BORROWS_EXCEEDED",
      `You have reached the maximum allowed limit of ${MAX_ACTIVE_BORROWS} active book loans/requests.`,
    );
  }

  try {
    return await withActor(userId, async (transaction) => {
      const created = await BorrowRequest.create(
        {
          user_id: userId,
          book_id: bookId,
          requested_days: requestedDays,
          status: "Pending",
          request_date: new Date(),
        },
        { transaction },
      );

      return {
        id: created.request_id,
        request_id: created.request_id,
        user_id: created.user_id,
        userId: created.user_id,
        book_id: created.book_id,
        bookId: created.book_id,
        book_title: book.title,
        bookTitle: book.title,
        requested_days: created.requested_days,
        requestedDays: created.requested_days,
        requestedDurationDays: created.requested_days,
        status: created.status,
        request_date: created.request_date,
        requestedAt: created.request_date,
        decision_reason: null,
        decisionReason: null,
        remarks: null,
        assigned_copy_id: null,
        assignedCopyId: null,
        pickup_deadline: null,
        pickupDeadline: null,
      };
    });
  } catch (error) {
    if (
      error instanceof UniqueConstraintError ||
      error?.original?.code === "23505"
    ) {
      throw new BorrowFlowError(
        409,
        "DUPLICATE_REQUEST",
        "You already have an active (pending or approved) request for this book.",
      );
    }
    if (error?.original?.code === "P0001") {
      throw new BorrowFlowError(403, "BORROW_INELIGIBLE", error.message, {
        reasons: [{ code: "TRIGGER_REJECTED", message: error.message }],
      });
    }
    throw error;
  }
}

/**
 * Step 1b: Student cancels their own pending or approved borrow request.
 */
export async function cancelBorrowRequest({ requestId, userId }) {
  await expireStalePickups();

  return withActor(userId, async (transaction) => {
    const request = await BorrowRequest.findOne({
      where: { request_id: requestId, user_id: userId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!request) {
      throw new BorrowFlowError(404, "REQUEST_NOT_FOUND", "Borrow request not found.");
    }

    const currentStatus = String(request.status).toLowerCase();
    if (
      currentStatus !== "pending" &&
      currentStatus !== "approved" &&
      currentStatus !== "on_hold" &&
      currentStatus !== "on hold"
    ) {
      throw new BorrowFlowError(
        409,
        "INVALID_STATE",
        "This request can no longer be cancelled.",
      );
    }

    // Release any reserved copy if request was Approved or On Hold
    const loan = await BorrowedBook.findOne({
      where: { request_id: requestId, status: "Reserved" },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (loan) {
      await loan.update({ status: "Cancelled" }, { transaction });
      await BookCopy.update(
        { status: "Available" },
        { where: { copy_id: loan.copy_id }, transaction },
      );
    }

    await request.update(
      {
        status: "Cancelled",
        remarks: "Cancelled by the student",
      },
      { transaction },
    );

    return {
      id: request.request_id,
      request_id: request.request_id,
      status: "Cancelled",
      decisionReason: "Cancelled by the student",
      remarks: "Cancelled by the student",
    };
  });
}

/**
 * Step 2: Librarian reviews a pending borrow request.
 */
export async function reviewBorrowRequest({
  requestId,
  reviewerId,
  decision,
  remarks,
  copyId,
}) {
  await expireStalePickups();

  return withActor(reviewerId, async (transaction) => {
    const request = await BorrowRequest.findByPk(requestId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!request) {
      throw new BorrowFlowError(404, "REQUEST_NOT_FOUND", "Borrow request not found.");
    }
    if (request.status !== "Pending") {
      throw new BorrowFlowError(
        409,
        "INVALID_STATUS",
        "Only pending requests can be reviewed.",
      );
    }

    if (decision === "reject") {
      if (!remarks || !remarks.trim()) {
        throw new BorrowFlowError(
          400,
          "REMARKS_REQUIRED",
          "Remarks are required when rejecting a request.",
        );
      }
      await BorrowRequest.update(
        {
          status: "Rejected",
          reviewed_by: reviewerId,
          reviewed_at: new Date(),
          remarks: remarks.trim(),
        },
        {
          where: { request_id: requestId },
          fields: ["status", "reviewed_by", "reviewed_at", "remarks"],
          transaction,
        },
      );

      return {
        message: "Request rejected successfully.",
        request_id: requestId,
        status: "Rejected",
        remarks: remarks.trim(),
      };
    }

    // decision === 'approve'
    const eligibility = await checkBorrowEligibility(request.user_id, {
      transaction,
    });
    if (!eligibility.eligible) {
      throw new BorrowFlowError(
        409,
        "STUDENT_INELIGIBLE",
        "Student is ineligible to borrow.",
        { reasons: eligibility.reasons },
      );
    }

    // Re-verify same-book limit and max active borrows limit
    const otherOpenRequestsForBook = await BorrowRequest.count({
      where: {
        user_id: request.user_id,
        book_id: request.book_id,
        request_id: { [Op.ne]: request.request_id },
        status: { [Op.in]: ["Pending", "Approved"] },
      },
      transaction,
    });
    const activeLoansForBook = await BorrowedBook.count({
      where: {
        book_id: request.book_id,
        status: "Borrowed",
      },
      include: [
        {
          model: BorrowRequest,
          as: "request",
          where: { user_id: request.user_id },
          required: true,
        },
      ],
      transaction,
    });
    if (otherOpenRequestsForBook + activeLoansForBook + 1 > MAX_COPIES_PER_BOOK) {
      throw new BorrowFlowError(
        409,
        "MAX_COPIES_PER_BOOK_EXCEEDED",
        `Student already has ${MAX_COPIES_PER_BOOK} active loan(s) or request(s) for this book.`,
      );
    }

    const otherOpenRequests = await BorrowRequest.count({
      where: {
        user_id: request.user_id,
        request_id: { [Op.ne]: request.request_id },
        status: { [Op.in]: ["Pending", "Approved"] },
      },
      transaction,
    });
    const totalActiveLoans = await BorrowedBook.count({
      where: {
        status: "Borrowed",
      },
      include: [
        {
          model: BorrowRequest,
          as: "request",
          where: { user_id: request.user_id },
          required: true,
        },
      ],
      transaction,
    });
    if (otherOpenRequests + totalActiveLoans + 1 > MAX_ACTIVE_BORROWS) {
      throw new BorrowFlowError(
        409,
        "MAX_ACTIVE_BORROWS_EXCEEDED",
        `Student has reached the maximum allowed limit of ${MAX_ACTIVE_BORROWS} active book loans/requests.`,
      );
    }

    let chosenCopyId = copyId;
    if (chosenCopyId) {
      const copy = await BookCopy.findOne({
        where: { copy_id: chosenCopyId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (
        !copy ||
        String(copy.book_id) !== String(request.book_id) ||
        copy.status !== "Available" ||
        copy.condition_status !== "Good"
      ) {
        throw new BorrowFlowError(
          409,
          "COPY_NOT_AVAILABLE",
          "Selected copy is not available or does not belong to this book.",
        );
      }
    } else {
      const availableCopy = await BookCopy.findOne({
        where: {
          book_id: request.book_id,
          status: "Available",
          condition_status: "Good",
        },
        order: [["copy_id", "ASC"]],
        transaction,
        lock: transaction.LOCK.UPDATE,
        skipLocked: true,
      });
      if (!availableCopy) {
        throw new BorrowFlowError(
          409,
          "NO_COPY_AVAILABLE",
          "No available good-condition copy found for this book.",
        );
      }
      chosenCopyId = availableCopy.copy_id;
    }

    const borrowedBook = await BorrowedBook.create(
      {
        request_id: request.request_id,
        book_id: request.book_id,
        copy_id: chosenCopyId,
        status: "Reserved",
        assigned_by: reviewerId,
        assigned_at: new Date(),
        due_date: null,
        issued_by: null,
      },
      { transaction },
    );

    await BookCopy.update(
      { status: "Reserved" },
      { where: { copy_id: chosenCopyId }, transaction },
    );

    const pickupDeadline = new Date(
      Date.now() + PICKUP_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    await BorrowRequest.update(
      {
        status: "Approved",
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        pickup_deadline: pickupDeadline,
        remarks: remarks?.trim() || null,
      },
      {
        where: { request_id: requestId },
        fields: [
          "status",
          "reviewed_by",
          "reviewed_at",
          "pickup_deadline",
          "remarks",
        ],
        transaction,
      },
    );

    return {
      message: "Request approved and copy reserved.",
      request_id: requestId,
      status: "Approved",
      borrow_id: borrowedBook.borrow_id,
      loan: borrowedBook,
      copy_id: chosenCopyId,
      pickup_deadline: pickupDeadline,
    };
  });
}

/**
 * Step 4: Librarian marks a reserved loan picked up.
 */
export async function pickupBook({ borrowId, issuerId }) {
  return withActor(issuerId, async (transaction) => {
    const loan = await BorrowedBook.findByPk(borrowId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!loan) {
      throw new BorrowFlowError(404, "LOAN_NOT_FOUND", "Borrowed book record not found.");
    }

    const request = await BorrowRequest.findByPk(loan.request_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!request) {
      throw new BorrowFlowError(
        404,
        "REQUEST_NOT_FOUND",
        "Associated borrow request not found.",
      );
    }

    const copy = await BookCopy.findByPk(loan.copy_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!copy) {
      throw new BorrowFlowError(
        404,
        "COPY_NOT_FOUND",
        "Associated book copy not found.",
      );
    }

    if (loan.status !== "Reserved" || request.status !== "Approved") {
      throw new BorrowFlowError(
        409,
        "INVALID_STATUS",
        "Loan is not in Reserved status or request is not Approved.",
      );
    }

    if (
      request.pickup_deadline &&
      new Date() > new Date(request.pickup_deadline)
    ) {
      await loan.update({ status: "Cancelled" }, { transaction });
      await copy.update({ status: "Available" }, { transaction });
      await BorrowRequest.update(
        { status: "Expired" },
        {
          where: { request_id: request.request_id },
          fields: ["status"],
          transaction,
        },
      );
      throw new BorrowFlowError(
        409,
        "PICKUP_EXPIRED",
        "The pickup deadline has passed; this reservation has expired.",
      );
    }

    const eligibility = await checkBorrowEligibility(request.user_id, {
      transaction,
    });
    if (!eligibility.eligible) {
      throw new BorrowFlowError(
        409,
        "STUDENT_INELIGIBLE",
        "Student is ineligible for book pickup release.",
        { reasons: eligibility.reasons },
      );
    }

    const now = new Date();
    const dueDateObj = new Date(
      Date.now() + Number(request.requested_days) * 24 * 60 * 60 * 1000,
    );
    const dueDateStr = dueDateObj.toISOString().slice(0, 10);

    await loan.update(
      {
        status: "Borrowed",
        borrow_date: now,
        due_date: dueDateStr,
        issued_by: issuerId,
        picked_up_at: now,
      },
      { transaction },
    );

    await copy.update({ status: "Borrowed" }, { transaction });

    await BorrowRequest.update(
      { status: "Fulfilled" },
      {
        where: { request_id: request.request_id },
        fields: ["status"],
        transaction,
      },
    );

    return {
      message: "Book pickup confirmed successfully.",
      borrow_id: loan.borrow_id,
      borrow_date: now,
      due_date: dueDateStr,
      status: "Borrowed",
    };
  });
}

/**
 * Step 4 check: Librarian performs pre-pickup check (read only).
 */
export async function getPickupCheck(borrowId) {
  await expireStalePickups();

  const loan = await BorrowedBook.findByPk(borrowId, {
    include: [
      {
        model: BorrowRequest,
        as: "request",
        attributes: [
          "request_id",
          "user_id",
          "status",
          "pickup_deadline",
          "requested_days",
        ],
      },
    ],
  });

  if (!loan) {
    throw new BorrowFlowError(404, "LOAN_NOT_FOUND", "Borrowed book record not found.");
  }

  const request = loan.request;
  if (!request) {
    throw new BorrowFlowError(
      404,
      "REQUEST_NOT_FOUND",
      "Associated borrow request not found.",
    );
  }

  const eligibility = await checkBorrowEligibility(request.user_id);

  const activeTerm = await AcademicTerm.findOne({
    where: { status: "Active" },
    attributes: ["term_id", "term_name"],
  });

  let verificationSummary = null;
  if (activeTerm) {
    const v = await StudentVerification.findOne({
      where: { user_id: request.user_id, term_id: activeTerm.term_id },
      attributes: ["status", "valid_from", "valid_until", "remarks"],
    });
    if (v) {
      verificationSummary = {
        term_name: activeTerm.term_name,
        status: v.status,
        valid_from: v.valid_from,
        valid_until: v.valid_until,
      };
    } else {
      verificationSummary = {
        term_name: activeTerm.term_name,
        status: "Missing",
      };
    }
  }

  const penaltiesRows = await sequelize.query(
    `SELECT penalty_id, borrow_id, penalty_type, amount, amount_paid, balance, status
     FROM public.v_user_active_penalties
     WHERE user_id = :userId`,
    {
      replacements: { userId: request.user_id },
      type: QueryTypes.SELECT,
    },
  );

  const totalBalance = penaltiesRows.reduce(
    (sum, p) => sum + Number(p.balance || 0),
    0,
  );

  const isExpired =
    request.pickup_deadline && new Date() > new Date(request.pickup_deadline);
  const canRelease =
    eligibility.eligible &&
    loan.status === "Reserved" &&
    request.status === "Approved" &&
    !isExpired;

  return {
    can_release: canRelease,
    reasons: eligibility.reasons,
    penalties: {
      list: penaltiesRows,
      total_balance: Number(totalBalance.toFixed(2)),
    },
    verification: verificationSummary,
    pickup_deadline: request.pickup_deadline,
  };
}

/**
 * Endpoint 2: Student lists own borrow requests.
 */
export async function listMyBorrowRequests(userId, { page = 1, limit = 10 }) {
  await expireStalePickups();
  const offset = (page - 1) * limit;

  const { count, rows } = await BorrowRequest.findAndCountAll({
    where: { user_id: userId },
    include: [
      {
        model: Book,
        as: "book",
        attributes: ["book_id", "title"],
        include: [
          {
            model: Author,
            as: "author",
            attributes: ["author_id", "first_name", "last_name"],
          },
        ],
      },
    ],
    order: [
      ["request_date", "DESC"],
      ["request_id", "DESC"],
    ],
    limit,
    offset,
  });

  const formatted = rows.map((reqRow) => ({
    id: reqRow.request_id,
    request_id: reqRow.request_id,
    bookId: reqRow.book_id,
    book_id: reqRow.book_id,
    bookTitle: reqRow.book?.title || null,
    book_title: reqRow.book?.title || null,
    author: reqRow.book?.author
      ? `${reqRow.book.author.first_name} ${reqRow.book.author.last_name}`
      : null,
    requestedDurationDays: reqRow.requested_days,
    requestedDays: reqRow.requested_days,
    requested_days: reqRow.requested_days,
    requestedAt: reqRow.request_date,
    request_date: reqRow.request_date,
    status: reqRow.status,
    remarks: reqRow.remarks,
    decisionReason: reqRow.remarks,
    decision_reason: reqRow.remarks,
    pickupDeadline: reqRow.pickup_deadline,
    pickup_deadline: reqRow.pickup_deadline,
  }));

  return {
    requests: formatted,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
}

/**
 * Endpoint 3: Queue of requests for staff review, oldest first.
 */
export async function listBorrowRequestsQueue({
  status = "Pending",
  page = 1,
  limit = 10,
}) {
  await expireStalePickups();
  const offset = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;

  const { count, rows } = await BorrowRequest.findAndCountAll({
    where,
    include: [
      {
        model: Book,
        as: "book",
        attributes: ["book_id", "title", "isbn"],
      },
      {
        model: Student,
        as: "student",
        attributes: [
          "user_id",
          "student_number",
          "college",
          "course",
          "year_level",
        ],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["user_id", "first_name", "last_name", "email"],
          },
        ],
      },
    ],
    order: [
      ["request_date", "ASC"],
      ["request_id", "ASC"],
    ],
    limit,
    offset,
  });

  const requestsWithEligibility = await Promise.all(
    rows.map(async (row) => {
      const eligibility = await checkBorrowEligibility(row.user_id);
      return {
        id: row.request_id,
        request_id: row.request_id,
        userId: row.user_id,
        user_id: row.user_id,
        bookId: row.book_id,
        book_id: row.book_id,
        requestedDurationDays: row.requested_days,
        requestedDays: row.requested_days,
        requested_days: row.requested_days,
        requestedAt: row.request_date,
        request_date: row.request_date,
        status: row.status,
        reviewed_by: row.reviewed_by,
        reviewed_at: row.reviewed_at,
        pickupDeadline: row.pickup_deadline,
        pickup_deadline: row.pickup_deadline,
        decisionReason: row.remarks,
        remarks: row.remarks,
        book: row.book
          ? {
              id: row.book.book_id,
              book_id: row.book.book_id,
              title: row.book.title,
              isbn: row.book.isbn,
            }
          : null,
        student: row.student
          ? {
              id: row.student.user_id,
              userId: row.student.user_id,
              user_id: row.student.user_id,
              name: row.student.user
                ? `${row.student.user.first_name} ${row.student.user.last_name}`
                : null,
              studentNumber: row.student.student_number,
              student_number: row.student.student_number,
              college: row.student.college,
              program: row.student.course,
              course: row.student.course,
              yearLevel: row.student.year_level,
              year_level: row.student.year_level,
            }
          : null,
        eligibility: {
          eligible: eligibility.eligible,
          reason_codes: eligibility.reasons.map((r) => r.code),
          reasons: eligibility.reasons,
        },
      };
    }),
  );

  return {
    requests: requestsWithEligibility,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
}

/**
 * Endpoint 4: Available copies of requested book for selection.
 */
export async function getAvailableCopiesForRequest(requestId) {
  const request = await BorrowRequest.findByPk(requestId, {
    attributes: ["request_id", "book_id"],
  });
  if (!request) {
    throw new BorrowFlowError(404, "REQUEST_NOT_FOUND", "Borrow request not found.");
  }

  const copies = await BookCopy.findAll({
    where: {
      book_id: request.book_id,
      status: "Available",
      condition_status: "Good",
    },
    attributes: ["copy_id", "accession_no", "shelf_location"],
    order: [["copy_id", "ASC"]],
  });

  return copies;
}

/**
 * Endpoint 6: Student lists own loans.
 */
export async function listMyBorrowedBooks(userId, { status }) {
  await expireStalePickups();

  const loanWhere = {};
  if (status) loanWhere.status = status;

  const loans = await BorrowedBook.findAll({
    where: loanWhere,
    include: [
      {
        model: BorrowRequest,
        as: "request",
        where: { user_id: userId },
        attributes: [
          "request_id",
          "user_id",
          "pickup_deadline",
          "requested_days",
        ],
        required: true,
      },
      {
        model: Book,
        as: "book",
        attributes: ["book_id", "title", "cover_image"],
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
        attributes: ["copy_id", "accession_no", "shelf_location"],
      },
    ],
    order: [["borrow_id", "DESC"]],
  });

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  return loans.map((loan) => {
    let daysRemaining = null;
    let isOverdue = false;

    if (loan.status === "Borrowed" && loan.due_date) {
      const due = new Date(loan.due_date);
      const diffMs = due.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isOverdue = loan.due_date < todayStr;
    }

    return {
      borrow_id: loan.borrow_id,
      book: {
        title: loan.book?.title,
        cover_image: loan.book?.cover_image,
        author: loan.book?.author
          ? `${loan.book.author.first_name} ${loan.book.author.last_name}`
          : null,
      },
      accession_no: loan.copy?.accession_no,
      shelf_location: loan.copy?.shelf_location,
      status: loan.status,
      pickup_deadline:
        loan.status === "Reserved" ? loan.request?.pickup_deadline : null,
      borrow_date: loan.borrow_date,
      due_date: loan.due_date,
      days_remaining: daysRemaining,
      is_overdue: isOverdue,
    };
  });
}

/**
 * Endpoint 7: Staff lists loans (Reserved, Borrowed). Searchable.
 */
export async function listBorrowedBooksStaff({
  status,
  search,
  page = 1,
  limit = 10,
}) {
  await expireStalePickups();
  const offset = (page - 1) * limit;

  const loanWhere = {};
  if (status) {
    if (status.includes(",")) {
      loanWhere.status = { [Op.in]: status.split(",").map((s) => s.trim()) };
    } else {
      loanWhere.status = status;
    }
  }

  const searchFilter = search ? search.trim() : "";
  const whereConditions = [];

  if (searchFilter) {
    whereConditions.push({
      [Op.or]: [
        {
          "$request.student.student_number$": { [Op.iLike]: `%${searchFilter}%` },
        },
        {
          "$request.student.user.first_name$": { [Op.iLike]: `%${searchFilter}%` },
        },
        {
          "$request.student.user.last_name$": { [Op.iLike]: `%${searchFilter}%` },
        },
        { "$copy.accession_no$": { [Op.iLike]: `%${searchFilter}%` } },
        { "$book.title$": { [Op.iLike]: `%${searchFilter}%` } },
      ],
    });
  }

  const { count, rows } = await BorrowedBook.findAndCountAll({
    where: {
      ...loanWhere,
      ...(whereConditions.length > 0 ? { [Op.and]: whereConditions } : {}),
    },
    include: [
      {
        model: BorrowRequest,
        as: "request",
        required: true,
        attributes: [
          "request_id",
          "user_id",
          "pickup_deadline",
          "requested_days",
        ],
        include: [
          {
            model: Student,
            as: "student",
            required: true,
            attributes: [
              "user_id",
              "student_number",
              "college",
              "course",
              "year_level",
            ],
            include: [
              {
                model: User,
                as: "user",
                required: true,
                attributes: ["user_id", "first_name", "last_name", "email"],
              },
            ],
          },
        ],
      },
      {
        model: Book,
        as: "book",
        required: true,
        attributes: ["book_id", "title", "isbn"],
      },
      {
        model: BookCopy,
        as: "copy",
        required: true,
        attributes: ["copy_id", "accession_no", "shelf_location"],
      },
    ],
    order: [["borrow_id", "DESC"]],
    limit,
    offset,
  });

  const formatted = rows.map((loan) => {
    const student = loan.request?.student;
    const user = student?.user;
    return {
      borrow_id: loan.borrow_id,
      request_id: loan.request_id,
      status: loan.status,
      borrow_date: loan.borrow_date,
      due_date: loan.due_date,
      pickup_deadline: loan.request?.pickup_deadline,
      book: {
        book_id: loan.book?.book_id,
        title: loan.book?.title,
        isbn: loan.book?.isbn,
      },
      copy: {
        copy_id: loan.copy?.copy_id,
        accession_no: loan.copy?.accession_no,
        shelf_location: loan.copy?.shelf_location,
      },
      student: {
        user_id: student?.user_id,
        student_number: student?.student_number,
        name: user ? `${user.first_name} ${user.last_name}` : null,
        email: user?.email,
      },
    };
  });

  return {
    loans: formatted,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
}
