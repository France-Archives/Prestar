// Server/services/penaltyPaymentService.js
import { Op } from "sequelize";
import {
  sequelize,
  Penalty,
  Payment,
  BorrowedBook,
  BorrowRequest,
  Book,
  Student,
  User,
} from "../models/index.js";
import { BorrowFlowError } from "./borrowFlowService.js";
import { createNotification } from "./notificationService.js";
import withActor from "../utils/withActor.js";

/**
 * Normalizes penalty types to frontend enum values.
 */
export function mapPenaltyTypeToEnum(penaltyType) {
  if (!penaltyType) return "OTHER";
  const s = String(penaltyType).trim().toUpperCase();
  if (s.includes("DAMAGE")) return "DAMAGED_BOOK";
  if (s.includes("LOST")) return "LOST_BOOK";
  if (s.includes("LATE") || s.includes("OVERDUE")) return "LATE_RETURN";
  return "OTHER";
}

/**
 * Normalizes DB penalty status for frontend consumers.
 */
export function mapPenaltyStatus(status) {
  if (!status) return "UNPAID";
  const s = String(status).trim().toUpperCase();
  if (s === "PAID") return "PAID";
  if (s === "WAIVED") return "WAIVED";
  if (s === "PARTIALLY PAID" || s === "PARTIALLY_PAID") return "PARTIALLY_PAID";
  return "UNPAID";
}

/**
 * Formats a Penalty database instance into a consistent staff fine object.
 */
export function formatStaffFine(penalty) {
  const plain = typeof penalty.get === "function" ? penalty.get({ plain: true }) : penalty;
  const borrow = plain.borrow || {};
  const request = borrow.request || {};
  const student = request.student || {};
  const user = student.user || request.user || {};
  const book = borrow.book || request.book || {};
  const payments = Array.isArray(plain.payments) ? plain.payments : [];

  const completedPayment = payments.find((p) => p.payment_status === "Completed") || null;
  const amount = Number(plain.amount || 0);
  const isPaid = plain.status === "Paid";
  const paidAmount = isPaid ? amount : 0;
  const balance = isPaid ? 0 : amount;
  const receiptNo = completedPayment?.receipt_no || null;

  return {
    id: String(plain.penalty_id),
    penaltyId: String(plain.penalty_id),
    borrowId: plain.borrow_id ? String(plain.borrow_id) : null,
    returnId: plain.return_id ? String(plain.return_id) : null,
    fineType: mapPenaltyTypeToEnum(plain.penalty_type),
    fineTypeLabel: plain.penalty_type,
    amount,
    paidAmount,
    balance,
    status: plain.status, // "Unpaid", "Paid", "Waived"
    statusEnum: mapPenaltyStatus(plain.status),
    receiptNo,
    referenceNumber: receiptNo,
    reason: plain.reason,
    recordedAt: plain.created_at ? new Date(plain.created_at).toISOString() : new Date().toISOString(),
    waivedAt: plain.waived_at ? new Date(plain.waived_at).toISOString() : null,
    waivedBy: plain.waived_by ? String(plain.waived_by) : null,
    waiveRemarks: plain.waive_remarks || null,
    student: {
      id: student.user_id ? String(student.user_id) : "",
      userId: student.user_id ? String(student.user_id) : "",
      studentNumber: student.student_number || "",
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      email: user.email || "",
    },
    book: {
      id: book.book_id ? String(book.book_id) : "",
      title: book.title || "Unknown Book",
      isbn: book.isbn || "",
    },
    bookTitle: book.title || "Unknown Book",
  };
}

/**
 * Formats a Payment database instance into a consistent StaffPayment object.
 */
export function formatStaffPayment(payment) {
  const plain = typeof payment.get === "function" ? payment.get({ plain: true }) : payment;
  const penalty = plain.penalty || {};
  const borrow = penalty.borrow || {};
  const request = borrow.request || {};
  const student = request.student || {};
  const user = student.user || request.user || {};
  const book = borrow.book || request.book || {};
  const receiver = plain.receiver || {};

  const receiverName = receiver.first_name || receiver.last_name
    ? `${receiver.first_name || ""} ${receiver.last_name || ""}`.trim()
    : "Library Staff";

  const receipt = plain.receipt_no || null;

  return {
    id: String(plain.payment_id),
    paymentId: String(plain.payment_id),
    fineId: String(plain.penalty_id),
    penaltyId: String(plain.penalty_id),
    amount: Number(plain.amount || 0),
    paymentMethod: plain.payment_method || "Cash",
    paymentStatus: plain.payment_status || "Completed",
    receiptNo: receipt,
    referenceNumber: receipt,
    paidAt: plain.paid_at ? new Date(plain.paid_at).toISOString() : new Date(plain.created_at).toISOString(),
    recordedByUserId: plain.received_by ? String(plain.received_by) : null,
    recordedByName: receiverName,
    fineType: mapPenaltyTypeToEnum(penalty.penalty_type),
    fineTypeLabel: penalty.penalty_type || "Penalty",
    bookTitle: book.title || "Unknown Book",
    remarks: plain.remarks || null,
    student: {
      id: student.user_id ? String(student.user_id) : "",
      userId: student.user_id ? String(student.user_id) : "",
      studentNumber: student.student_number || "",
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      email: user.email || "",
    },
  };
}

/**
 * Lists all staff fines with optional status filter and search.
 */
export async function listStaffFines({ status, search, page = 1, limit = 50 } = {}) {
  const where = {};

  if (status) {
    const raw = String(status).trim();
    if (raw.toUpperCase() === "UNPAID") {
      where.status = "Unpaid";
    } else if (raw.toUpperCase() === "PAID") {
      where.status = "Paid";
    } else if (raw.toUpperCase() === "WAIVED") {
      where.status = "Waived";
    } else {
      where.status = raw;
    }
  }

  const fines = await Penalty.findAll({
    where,
    include: [
      {
        model: BorrowedBook,
        as: "borrow",
        include: [
          { model: Book, as: "book", attributes: ["book_id", "title", "isbn"] },
          {
            model: BorrowRequest,
            as: "request",
            include: [
              {
                model: Student,
                as: "student",
                attributes: ["user_id", "student_number"],
                include: [{ model: User, as: "user", attributes: ["user_id", "email", "first_name", "last_name"] }],
              },
            ],
          },
        ],
      },
      {
        model: Payment,
        as: "payments",
        where: { payment_status: "Completed" },
        required: false,
      },
    ],
    order: [["created_at", "DESC"]],
  });

  let formatted = fines.map(formatStaffFine);

  if (search && typeof search === "string" && search.trim()) {
    const term = search.trim().toLowerCase();
    formatted = formatted.filter((f) => {
      const studentName = `${f.student.firstName} ${f.student.lastName}`.toLowerCase();
      const studentNum = f.student.studentNumber.toLowerCase();
      const bookTitle = f.bookTitle.toLowerCase();
      const receipt = (f.receiptNo || "").toLowerCase();
      return (
        studentName.includes(term) ||
        studentNum.includes(term) ||
        bookTitle.includes(term) ||
        receipt.includes(term)
      );
    });
  }

  const numLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const numPage = Math.max(1, Number(page) || 1);
  const total = formatted.length;
  const paginated = formatted.slice((numPage - 1) * numLimit, numPage * numLimit);

  return {
    data: paginated,
    fines: paginated,
    total,
    page: numPage,
    limit: numLimit,
  };
}

/**
 * Records an in-person cash payment for a penalty in full.
 * Rejects partial payments strictly.
 */
export async function recordCashPayment(penaltyId, payload, librarianUserId) {
  const id = Number(penaltyId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BorrowFlowError(400, "VALIDATION_ERROR", "Penalty ID must be a positive integer.");
  }

  const { amount, receiptNo, referenceNumber, receipt_no, remarks } = payload || {};
  const rawReceipt = receiptNo || referenceNumber || receipt_no;

  if (!rawReceipt || typeof rawReceipt !== "string" || !rawReceipt.trim()) {
    throw new BorrowFlowError(400, "VALIDATION_ERROR", "Receipt number is required to record a payment.");
  }
  const cleanReceipt = rawReceipt.trim();

  const penalty = await Penalty.findByPk(id, {
    include: [
      {
        model: BorrowedBook,
        as: "borrow",
        include: [
          { model: Book, as: "book" },
          {
            model: BorrowRequest,
            as: "request",
            include: [{ model: Student, as: "student" }],
          },
        ],
      },
    ],
  });

  if (!penalty) {
    throw new BorrowFlowError(404, "NOT_FOUND", "We could not find that penalty.");
  }

  if (penalty.status === "Paid") {
    throw new BorrowFlowError(400, "INVALID_STATE", "This penalty has already been paid in full.");
  }
  if (penalty.status === "Waived") {
    throw new BorrowFlowError(400, "INVALID_STATE", "This penalty was waived and cannot accept payment.");
  }

  const penaltyAmount = Number(penalty.amount);
  const paymentAmount = Number(amount);

  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    throw new BorrowFlowError(400, "VALIDATION_ERROR", "Payment amount must be greater than 0.");
  }

  // STRICT RULE: No partial payments accepted. Full payment only!
  if (Math.abs(paymentAmount - penaltyAmount) > 0.001) {
    throw new BorrowFlowError(
      400,
      "PARTIAL_PAYMENT_NOT_ALLOWED",
      `Partial payments are not accepted. Full payment of ₱${penaltyAmount.toFixed(2)} is required.`
    );
  }

  // Check unique receipt_no across payments
  const existingReceipt = await Payment.findOne({ where: { receipt_no: cleanReceipt } });
  if (existingReceipt) {
    throw new BorrowFlowError(
      409,
      "CONFLICT",
      `Receipt number "${cleanReceipt}" already exists in the system. Please enter a unique receipt number.`
    );
  }

  let createdPayment = null;
  const bookTitle = penalty.borrow?.book?.title || "your borrowed book";
  const studentUserId = penalty.borrow?.request?.user_id || penalty.borrow?.request?.student?.user_id;

  await withActor(librarianUserId, async (transaction) => {
    createdPayment = await Payment.create(
      {
        penalty_id: penalty.penalty_id,
        amount: penaltyAmount,
        payment_method: "Cash",
        payment_status: "Completed",
        receipt_no: cleanReceipt,
        paid_at: new Date(),
        received_by: librarianUserId,
        remarks: remarks?.trim() || null,
      },
      { transaction }
    );

    await penalty.update(
      {
        status: "Paid",
      },
      { transaction }
    );

    // Notify student of full settlement
    if (studentUserId) {
      await createNotification({
        userId: studentUserId,
        type: "FINE_PAYMENT_RECORDED",
        title: "Payment received",
        message: `Payment of ₱${penaltyAmount.toFixed(2)} received in full for "${bookTitle}". Receipt No. ${cleanReceipt}.`,
        relatedEntityType: "PENALTY",
        relatedEntityId: penalty.penalty_id,
        transaction,
      });
    }
  });

  return {
    message: "Payment recorded and penalty settled successfully.",
    payment: {
      id: String(createdPayment.payment_id),
      paymentId: String(createdPayment.payment_id),
      penaltyId: String(penalty.penalty_id),
      amount: penaltyAmount,
      paymentMethod: "Cash",
      paymentStatus: "Completed",
      receiptNo: cleanReceipt,
      referenceNumber: cleanReceipt,
      paidAt: createdPayment.paid_at.toISOString(),
    },
    fine: {
      id: String(penalty.penalty_id),
      status: "Paid",
      balance: 0.0,
      paidAmount: penaltyAmount,
    },
  };
}

/**
 * Settled Payments API for the frontend Payment Recording screen (Payment History table).
 */
export async function listStaffPayments({ search, page = 1, limit = 50 } = {}) {
  const payments = await Payment.findAll({
    where: { payment_status: "Completed" },
    include: [
      {
        model: Penalty,
        as: "penalty",
        include: [
          {
            model: BorrowedBook,
            as: "borrow",
            include: [
              { model: Book, as: "book", attributes: ["book_id", "title"] },
              {
                model: BorrowRequest,
                as: "request",
                include: [
                  {
                    model: Student,
                    as: "student",
                    attributes: ["user_id", "student_number"],
                    include: [{ model: User, as: "user", attributes: ["user_id", "email", "first_name", "last_name"] }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        model: User,
        as: "receiver",
        attributes: ["user_id", "first_name", "last_name", "role"],
      },
    ],
    order: [["paid_at", "DESC"], ["created_at", "DESC"]],
  });

  let formatted = payments.map(formatStaffPayment);

  if (search && typeof search === "string" && search.trim()) {
    const term = search.trim().toLowerCase();
    formatted = formatted.filter((p) => {
      const studentName = `${p.student.firstName} ${p.student.lastName}`.toLowerCase();
      const studentNum = p.student.studentNumber.toLowerCase();
      const bookTitle = p.bookTitle.toLowerCase();
      const receipt = (p.receiptNo || "").toLowerCase();
      const recordedBy = p.recordedByName.toLowerCase();
      return (
        studentName.includes(term) ||
        studentNum.includes(term) ||
        bookTitle.includes(term) ||
        receipt.includes(term) ||
        recordedBy.includes(term)
      );
    });
  }

  const numLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const numPage = Math.max(1, Number(page) || 1);
  const total = formatted.length;
  const paginated = formatted.slice((numPage - 1) * numLimit, numPage * numLimit);

  return {
    data: paginated,
    payments: paginated,
    total,
    page: numPage,
    limit: numLimit,
  };
}

/**
 * Waives a penalty with an audited reason.
 */
export async function waivePenalty(penaltyId, payload, staffUserId) {
  const id = Number(penaltyId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BorrowFlowError(400, "VALIDATION_ERROR", "Penalty ID must be a positive integer.");
  }

  const { reason } = payload || {};
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    throw new BorrowFlowError(422, "VALIDATION_ERROR", "A reason is required to waive a fine.");
  }

  const penalty = await Penalty.findByPk(id, {
    include: [
      {
        model: BorrowedBook,
        as: "borrow",
        include: [
          { model: Book, as: "book" },
          {
            model: BorrowRequest,
            as: "request",
            include: [{ model: Student, as: "student" }],
          },
        ],
      },
    ],
  });

  if (!penalty) {
    throw new BorrowFlowError(404, "NOT_FOUND", "We could not find that fine.");
  }

  if (penalty.status === "Paid" || penalty.status === "Waived") {
    throw new BorrowFlowError(409, "INVALID_STATE", "Only an unpaid penalty can be waived.");
  }

  const bookTitle = penalty.borrow?.book?.title || "your borrowed book";
  const studentUserId = penalty.borrow?.request?.user_id || penalty.borrow?.request?.student?.user_id;

  await withActor(staffUserId, async (transaction) => {
    await penalty.update(
      {
        status: "Waived",
        waived_by: staffUserId,
        waived_at: new Date(),
        waive_remarks: reason.trim(),
      },
      { transaction }
    );

    if (studentUserId) {
      await createNotification({
        userId: studentUserId,
        type: "FINE_WAIVED",
        title: "Fine waived",
        message: `Your ${penalty.penalty_type.toLowerCase()} fine for "${bookTitle}" was waived: ${reason.trim()}`,
        relatedEntityType: "PENALTY",
        relatedEntityId: penalty.penalty_id,
        transaction,
      });
    }
  });

  return {
    message: "Penalty waived successfully.",
    fine: formatStaffFine(penalty),
  };
}

/**
 * Gets fines for the logged-in student.
 */
export async function getStudentFines(userId) {
  const student = await Student.findOne({ where: { user_id: userId } });
  if (!student) {
    return {
      message: "Please pay in cash at the library counter. The library accepts cash only in full.",
      data: [],
      fines: [],
      totalBalance: 0,
    };
  }

  const requests = await BorrowRequest.findAll({
    where: { user_id: student.user_id },
    attributes: ["request_id"],
  });

  const requestIds = requests.map((r) => r.request_id);
  if (requestIds.length === 0) {
    return {
      message: "Please pay in cash at the library counter. The library accepts cash only in full.",
      data: [],
      fines: [],
      totalBalance: 0,
    };
  }

  const borrows = await BorrowedBook.findAll({
    where: { request_id: { [Op.in]: requestIds } },
    attributes: ["borrow_id"],
  });

  const borrowIds = borrows.map((b) => b.borrow_id);
  if (borrowIds.length === 0) {
    return {
      message: "Please pay in cash at the library counter. The library accepts cash only in full.",
      data: [],
      fines: [],
      totalBalance: 0,
    };
  }

  const fines = await Penalty.findAll({
    where: { borrow_id: { [Op.in]: borrowIds } },
    include: [
      {
        model: BorrowedBook,
        as: "borrow",
        include: [{ model: Book, as: "book", attributes: ["book_id", "title", "isbn"] }],
      },
      {
        model: Payment,
        as: "payments",
        where: { payment_status: "Completed" },
        required: false,
      },
    ],
    order: [["created_at", "DESC"]],
  });

  const formatted = fines.map(formatStaffFine);
  const totalBalance = formatted
    .filter((f) => f.status === "Unpaid")
    .reduce((sum, f) => sum + f.balance, 0);

  return {
    message: "Please pay in cash at the library counter. The library accepts cash only in full.",
    data: formatted,
    fines: formatted,
    totalBalance,
  };
}
