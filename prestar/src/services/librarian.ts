import type { Book, BorrowedBook, Category, ConditionStatus, CopyStatus, RequestStatus, ReservationStatus } from "../types";
import { CONFIG } from "../utils/constants";
import { addDaysToDate, daysOverdue, fmtDate, fmtDateTime, todayStr } from "../utils/dates";
import { fullName, indexBy } from "../utils/lookup";
import { loanStatus, requestStatus } from "../utils/status";
import { bookAvailability, checkEligibility, freeToRequest, getDb, isOverdue, queuePosition, renewalState } from "./api";
import { standingOf } from "./reports";

// TEMPORARY MOCK — read side of the Librarian pages.
// Each function below returns ready-to-display rows, so pages never touch database tables.
// BACKEND REPLACEMENT: every function maps to one GET endpoint (see the API contract in the handover notes),
// for example getBorrowRequests() -> GET /librarian/requests. Keep the returned row shapes the same
// and the pages will not need to change. Writes (approve, issue, return, ...) stay in services/api.ts.

const sameDay = (iso: string, day: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` === day;
};
const isFuture = (iso: string | null) => iso !== null && new Date(iso).getTime() >= Date.now();

// ---------- dashboard ----------
export interface LibrarianStats {
  pending: number;
  approved: number;
  borrowed: number;
  overdue: number;
  returnedToday: number;
  availableCopies: number;
  waitingReservations: number;
}
export function getLibrarianStats(): LibrarianStats {
  const db = getDb();
  const today = todayStr();
  return {
    pending: db.borrow_requests.filter((r) => r.status === "Pending").length,
    approved: db.borrow_requests.filter((r) => r.status === "Approved" && isFuture(r.pickup_deadline)).length,
    borrowed: db.borrowed_books.filter((l) => l.status === "Borrowed").length,
    overdue: db.borrowed_books.filter(isOverdue).length,
    returnedToday: db.returned_books.filter((r) => sameDay(r.return_date, today)).length,
    availableCopies: db.book_copies.filter((c) => c.status === "Available").length,
    waitingReservations: db.reservations.filter((r) => r.status === "Waiting" || (r.status === "Ready" && isFuture(r.expires_at))).length,
  };
}

// ---------- catalog ----------
export type CatalogRow = Book & { id: number; category: string; copies: number; free: number; queue: number };
export function getCatalogRows(): CatalogRow[] {
  const db = getDb();
  const cats = indexBy(db.categories, "category_id");
  return db.books.map((b) => {
    const a = bookAvailability(b.book_id);
    return { ...b, id: b.book_id, category: cats[b.category_id]?.category_name ?? "—", copies: a.totalCopies, free: a.free, queue: a.queueLength };
  });
}
export const getCategories = (): Category[] => getDb().categories;

// ---------- inventory (physical copies; a Book and its BookCopy rows stay separate) ----------
export interface CopyRow {
  id: number;
  bookId: number;
  book: string;
  accessionNo: string;
  condition: ConditionStatus;
  status: CopyStatus;
  location: string;
  borrower: string;
}
export function getCopyRows(bookId?: number): CopyRow[] {
  const db = getDb();
  const books = indexBy(db.books, "book_id");
  const users = indexBy(db.users, "user_id");
  return db.book_copies
    .filter((c) => bookId === undefined || c.book_id === bookId)
    .map((c) => {
      const loan = db.borrowed_books.find((l) => l.copy_id === c.copy_id && l.status === "Borrowed");
      return {
        id: c.copy_id,
        bookId: c.book_id,
        book: books[c.book_id]?.title ?? "—",
        accessionNo: c.accession_no,
        condition: c.condition_status,
        status: c.status,
        location: books[c.book_id]?.shelf_location ?? "—",
        borrower: loan ? fullName(users[loan.user_id]) : "—",
      };
    });
}

// ---------- requests ----------
export interface RequestRow {
  id: number;
  userId: number;
  student: string;
  standing: string;
  bookId: number;
  book: string;
  date: string;
  status: RequestStatus; // effective status (an Approved request past its pickup deadline shows Expired)
  free: number; // copies still free to promise right now
  note: string;
  sortKey: string;
}
export function getBorrowRequests(): RequestRow[] {
  const db = getDb();
  const users = indexBy(db.users, "user_id");
  const books = indexBy(db.books, "book_id");
  return db.borrow_requests
    .map((r): RequestRow => {
      const status = requestStatus(r);
      return {
        id: r.request_id,
        userId: r.user_id,
        student: fullName(users[r.user_id]),
        standing: standingOf(r.user_id),
        bookId: r.book_id,
        book: books[r.book_id]?.title ?? "—",
        date: fmtDateTime(r.request_date),
        status,
        free: Math.max(0, freeToRequest(r.book_id)),
        note: status === "Approved" ? `Pick up by ${fmtDateTime(r.pickup_deadline)}` : (r.remarks ?? ""),
        sortKey: r.request_date,
      };
    })
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

// ---------- issue / handover ----------
export interface IssueRow {
  id: string;
  kind: "request" | "reservation";
  sourceId: number;
  userId: number;
  student: string;
  standing: string;
  blockers: string[]; // reasons the student can no longer borrow (shown before handover)
  bookId: number;
  book: string;
  until: string;
  copies: { copyId: number; accessionNo: string }[]; // physical copies that can be assigned
  dueDate: string;
}
export function getIssueQueue(): IssueRow[] {
  const db = getDb();
  const users = indexBy(db.users, "user_id");
  const books = indexBy(db.books, "book_id");
  const dueDate = addDaysToDate(todayStr(), CONFIG.LOAN_DAYS);
  const build = (kind: IssueRow["kind"], sourceId: number, userId: number, bookId: number, until: string | null): IssueRow => ({
    id: `${kind}-${sourceId}`,
    kind,
    sourceId,
    userId,
    student: fullName(users[userId]),
    standing: standingOf(userId),
    blockers: checkEligibility(userId, "promote").map((i) => i.message),
    bookId,
    book: books[bookId]?.title ?? "—",
    until: fmtDateTime(until),
    copies: db.book_copies.filter((c) => c.book_id === bookId && c.status === "Available").map((c) => ({ copyId: c.copy_id, accessionNo: c.accession_no })),
    dueDate,
  });
  return [
    ...db.borrow_requests.filter((r) => r.status === "Approved" && isFuture(r.pickup_deadline)).map((r) => build("request", r.request_id, r.user_id, r.book_id, r.pickup_deadline)),
    ...db.reservations.filter((r) => r.status === "Ready" && isFuture(r.expires_at)).map((r) => build("reservation", r.reservation_id, r.user_id, r.book_id, r.expires_at)),
  ];
}

// ---------- loans, returns, renewals, overdue ----------
export interface LoanRow {
  id: number;
  userId: number;
  student: string;
  bookId: number;
  book: string;
  accessionNo: string;
  borrowed: string;
  dueDate: string;
  due: string;
  status: string; // Borrowed | Due soon | Overdue | Returned | Lost
  late: number;
  fine: number; // overdue penalty if returned today (display only; the real penalty is created on return)
  renewals: number;
  loan: BorrowedBook;
}
function toLoanRow(l: BorrowedBook): LoanRow {
  const db = getDb();
  const users = indexBy(db.users, "user_id");
  const books = indexBy(db.books, "book_id");
  const copies = indexBy(db.book_copies, "copy_id");
  const late = l.status === "Borrowed" ? daysOverdue(l.due_date) : 0;
  return {
    id: l.borrow_id,
    userId: l.user_id,
    student: fullName(users[l.user_id]),
    bookId: l.book_id,
    book: books[l.book_id]?.title ?? "—",
    accessionNo: copies[l.copy_id]?.accession_no ?? "—",
    borrowed: fmtDate(l.borrow_date),
    dueDate: l.due_date,
    due: fmtDate(l.due_date),
    status: loanStatus(l),
    late,
    fine: late * CONFIG.OVERDUE_FINE_PER_DAY,
    renewals: l.renewal_count,
    loan: l,
  };
}
export const getOpenLoans = (): LoanRow[] =>
  getDb().borrowed_books.filter((l) => l.status === "Borrowed").map(toLoanRow).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
export const getLoanHistory = (): LoanRow[] =>
  getDb().borrowed_books.filter((l) => l.status !== "Borrowed").map(toLoanRow).sort((a, b) => b.id - a.id);
export const getOverdueLoans = (): LoanRow[] => getOpenLoans().filter((l) => l.late > 0).sort((a, b) => b.late - a.late);

export interface ReturnRow {
  id: number;
  student: string;
  book: string;
  accessionNo: string;
  returned: string;
  condition: ConditionStatus;
  late: number;
  sortKey: string;
}
export function getRecentReturns(): ReturnRow[] {
  const db = getDb();
  const loans = indexBy(db.borrowed_books, "borrow_id");
  const users = indexBy(db.users, "user_id");
  const books = indexBy(db.books, "book_id");
  const copies = indexBy(db.book_copies, "copy_id");
  return db.returned_books
    .map((r): ReturnRow => {
      const l = loans[r.borrow_id];
      return {
        id: r.return_id,
        student: fullName(users[l.user_id]),
        book: books[l.book_id]?.title ?? "—",
        accessionNo: copies[l.copy_id]?.accession_no ?? "—",
        returned: fmtDateTime(r.return_date),
        condition: r.condition_status,
        late: r.days_overdue,
        sortKey: r.return_date,
      };
    })
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .slice(0, 10);
}

export interface RenewalRow extends LoanRow {
  eligible: boolean;
  reason: string;
  newDue: string;
}
export const getRenewalRows = (): RenewalRow[] =>
  getOpenLoans().map((r) => {
    const s = renewalState(r.loan);
    return { ...r, eligible: s.ok, reason: s.reason ?? "", newDue: fmtDate(addDaysToDate(r.loan.due_date, CONFIG.RENEWAL_DAYS)) };
  });

// ---------- reservations ----------
export interface ReservationRow {
  id: number;
  student: string;
  book: string;
  date: string;
  status: ReservationStatus;
  info: string;
  open: boolean;
}
export function getReservationRows(): ReservationRow[] {
  const db = getDb();
  const users = indexBy(db.users, "user_id");
  const books = indexBy(db.books, "book_id");
  return db.reservations
    .map((r): ReservationRow => {
      const status: ReservationStatus = r.status === "Ready" && !isFuture(r.expires_at) ? "Expired" : r.status;
      return {
        id: r.reservation_id,
        student: fullName(users[r.user_id]),
        book: books[r.book_id]?.title ?? "—",
        date: fmtDateTime(r.reservation_date),
        status,
        info: status === "Waiting" ? `Queue position ${queuePosition(r)}` : status === "Ready" ? `Held until ${fmtDateTime(r.expires_at)}` : (r.remarks ?? ""),
        open: status === "Waiting" || status === "Ready",
      };
    })
    .sort((a, b) => Number(b.open) - Number(a.open) || b.id - a.id);
}

// ---------- penalties and suspensions ----------
export interface PenaltyRow {
  id: number;
  student: string;
  book: string;
  type: string;
  amount: string;
  status: string;
  created: string;
  receipt: string;
}
export function getPenaltyRows(): PenaltyRow[] {
  const db = getDb();
  const users = indexBy(db.users, "user_id");
  const books = indexBy(db.books, "book_id");
  const loans = indexBy(db.borrowed_books, "borrow_id");
  return db.penalties
    .map((p): PenaltyRow => ({
      id: p.penalty_id,
      student: fullName(users[p.user_id]),
      book: books[loans[p.borrow_id]?.book_id]?.title ?? "—",
      type: p.penalty_type,
      amount: p.amount.toFixed(2),
      status: p.status,
      created: fmtDate(p.created_at),
      receipt: p.receipt_no ?? "—",
    }))
    .sort((a, b) => (a.status === "Unpaid" ? 0 : 1) - (b.status === "Unpaid" ? 0 : 1) || b.id - a.id);
}
export interface SuspensionRow {
  id: number;
  student: string;
  reason: string;
  details: string;
  start: string;
  end: string;
  status: string;
}
export function getSuspensionRows(): SuspensionRow[] {
  const db = getDb();
  const users = indexBy(db.users, "user_id");
  return db.suspensions
    .map((s): SuspensionRow => ({ id: s.suspension_id, student: fullName(users[s.user_id]), reason: s.reason_type, details: s.reason_details, start: fmtDate(s.start_date), end: s.end_date ? fmtDate(s.end_date) : "Until lifted", status: s.status }))
    .sort((a, b) => (a.status === "Active" ? 0 : 1) - (b.status === "Active" ? 0 : 1) || b.id - a.id);
}
export const getStudentOptions = (): { id: number; name: string }[] =>
  getDb().users.filter((u) => u.role === "Student" && u.status === "Active").map((u) => ({ id: u.user_id, name: `${fullName(u)}${u.student_id ? ` (${u.student_id})` : ""}` }));