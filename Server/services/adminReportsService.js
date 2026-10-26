import { Op } from "sequelize";
import {
  BorrowedBook,
  Book,
  BorrowRequest,
  Payment,
  Penalty,
  ReturnedBook,
  Student,
  User,
} from "../models/index.js";
import { mapPenaltyTypeToEnum } from "./penaltyPaymentService.js";

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Validate calendar-date query filters and translate them to Manila calendar-day bounds. */
export function parseReportDateRange({ from, to } = {}) {
  if (from !== undefined && !isValidDate(from)) {
    const error = new Error("'from' must be a valid date in YYYY-MM-DD format.");
    error.status = 400;
    throw error;
  }
  if (to !== undefined && !isValidDate(to)) {
    const error = new Error("'to' must be a valid date in YYYY-MM-DD format.");
    error.status = 400;
    throw error;
  }
  if (from && to && from > to) {
    const error = new Error("'from' must be on or before 'to'.");
    error.status = 400;
    throw error;
  }

  const range = {};
  if (from) range[Op.gte] = new Date(`${from}T00:00:00+08:00`);
  if (to) {
    const nextDay = new Date(`${to}T00:00:00+08:00`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    range[Op.lt] = nextDay;
  }
  return Object.keys(range).length ? range : null;
}

const studentIncludes = {
  model: BorrowRequest,
  as: "request",
  required: true,
  include: [{
    model: Student,
    as: "student",
    required: true,
    attributes: ["student_number"],
    include: [{ model: User, as: "user", attributes: ["first_name", "last_name"] }],
  }],
};

function studentFields(request) {
  const student = request?.student;
  const user = student?.user;
  return {
    studentName: `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim(),
    studentNumber: student?.student_number ?? "",
  };
}

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

/** GET /api/admin/reports/borrowing */
export async function getBorrowingReport({ from, to } = {}) {
  const range = parseReportDateRange({ from, to });
  const where = range ? { borrow_date: range } : {};
  const loans = await BorrowedBook.findAll({
    where,
    include: [studentIncludes, { model: Book, as: "book", attributes: ["title"] }, { model: ReturnedBook, as: "returnRecord", required: false, attributes: ["return_date"] }],
    order: [["borrow_date", "DESC"], ["borrow_id", "DESC"]],
  });

  return loans.map((loan) => {
    const request = loan.request?.get ? loan.request.get({ plain: true }) : loan.request;
    const record = loan.get ? loan.get({ plain: true }) : loan;
    return {
      loanId: String(record.borrow_id),
      ...studentFields(request),
      bookTitle: record.book?.title ?? "Unknown Book",
      borrowedAt: iso(record.borrow_date),
      dueAt: record.due_date,
      returnedAt: iso(record.returnRecord?.return_date),
      status: record.status,
    };
  });
}

/** GET /api/admin/reports/overdue */
export async function getOverdueReport({ from, to } = {}) {
  const range = parseReportDateRange({ from, to });
  const where = { status: "Borrowed" };
  if (from || to) {
    where.due_date = {};
    if (from) where.due_date[Op.gte] = from;
    if (to) where.due_date[Op.lte] = to;
  }

  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  where.due_date = { ...(where.due_date ?? {}), [Op.lt]: todayKey };
  const loans = await BorrowedBook.findAll({
    where,
    include: [studentIncludes, { model: Book, as: "book", attributes: ["title"] }],
    order: [["due_date", "ASC"], ["borrow_id", "ASC"]],
  });

  return loans.map((loan) => {
    const request = loan.request?.get ? loan.request.get({ plain: true }) : loan.request;
    const record = loan.get ? loan.get({ plain: true }) : loan;
    const dueDay = Date.parse(`${record.due_date}T00:00:00Z`);
    const todayDay = Date.parse(`${todayKey}T00:00:00Z`);
    return {
      loanId: String(record.borrow_id),
      ...studentFields(request),
      bookTitle: record.book?.title ?? "Unknown Book",
      dueAt: record.due_date,
      overdueDays: Math.max(0, Math.floor((todayDay - dueDay) / 86_400_000)),
    };
  }).filter((row) => !range || ((!from || row.dueAt >= from) && (!to || row.dueAt <= to)))
    .sort((a, b) => b.overdueDays - a.overdueDays);
}

/** GET /api/admin/reports/fines */
export async function getFinesReport({ from, to } = {}) {
  const range = parseReportDateRange({ from, to });
  const fines = await Penalty.findAll({
    where: range ? { created_at: range } : {},
    include: [
      {
        model: BorrowedBook,
        as: "borrow",
        required: true,
        include: [studentIncludes],
      },
      {
        model: Payment,
        as: "payments",
        required: false,
        where: { payment_status: "Completed" },
        attributes: ["amount"],
      },
    ],
    order: [["created_at", "DESC"], ["penalty_id", "DESC"]],
  });

  return fines.map((fine) => {
    const record = fine.get ? fine.get({ plain: true }) : fine;
    const request = record.borrow?.request;
    const amount = Number(record.amount) || 0;
    const paidAmount = (record.payments ?? []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const waived = String(record.status).toLowerCase() === "waived";
    return {
      fineId: String(record.penalty_id),
      ...studentFields(request),
      fineType: mapPenaltyTypeToEnum(record.penalty_type),
      amount,
      paidAmount,
      balance: waived ? 0 : Math.max(0, amount - paidAmount),
      status: String(record.status).toUpperCase().replace(/\s+/g, "_"),
      recordedAt: iso(record.created_at),
    };
  });
}