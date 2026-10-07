import type { SignupStatus, Standing } from "../types";
import { fullName, indexBy } from "../utils/lookup";
import { daysOverdue, fmtDate, fmtDateTime, todayStr } from "../utils/dates";
import { loanStatus } from "../utils/status";
import { checkEligibility, getDb, isOverdue } from "./api";

// MOCK API — REPLACE WITH REAL API CALL LATER
// On the backend these are COUNT / SUM / GROUP BY queries. Nothing here is stored.

const ALERT_PENALTY_DAYS = 7; // "unpaid penalties older than a configured number of days" (placeholder)
const ALERT_SIGNUP_DAYS = 2; // "signups waiting for review beyond a threshold" (placeholder)

export interface ChartRow {
  label: string;
  value: number;
}
export type ReportRow = Record<string, string | number>;
export interface ReportColumn {
  key: string;
  label: string;
}
export interface ReportResult {
  columns: ReportColumn[];
  rows: ReportRow[];
}
export type ReportKey =
  | "current"
  | "overdue"
  | "returned"
  | "lostDamaged"
  | "history"
  | "mostBorrowed"
  | "inventory"
  | "category"
  | "userActivity";
export type ActivityKind = "Lending" | "Returns" | "Requests" | "Penalties" | "Suspensions" | "Signups";
export interface ActivityEvent {
  id: string;
  date: string;
  actor_id: number;
  kind: ActivityKind;
  text: string;
  who: string;
  when: string;
  time: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const ts = (v: string) => new Date(v.length === 10 ? `${v}T00:00:00` : v).getTime();
const inRange = (iso: string | null, from: string, to: string) => {
  if (!iso) return false;
  const d = localDate(iso);
  return (!from || d >= from) && (!to || d <= to);
};
function countBy<T, K extends string | number>(rows: T[], fn: (r: T) => K): { label: K; value: number }[] {
  const m = new Map<K, number>();
  rows.forEach((r) => {
    const k = fn(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  });
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

// Derived borrowing standing (one badge for the Users table)
const STANDING_BY_CODE: Partial<Record<string, Standing>> = { A: "Inactive", B: "Not enrolled", C: "Suspended", D: "Penalty", E: "Overdue" };
export function standingOf(uid: number): Standing {
  const u = getDb().users.find((x) => x.user_id === uid);
  if (!u || u.role !== "Student") return "—";
  const code = checkEligibility(uid, "promote")[0]?.code;
  return (code && STANDING_BY_CODE[code]) || "OK";
}

export function adminStats() {
  const db = getDb();
  return {
    users: db.users.length,
    activeStudents: db.users.filter((u) => u.role === "Student" && u.status === "Active").length,
    librarians: db.users.filter((u) => u.role === "Librarian" && u.status === "Active").length,
    books: db.books.filter((b) => b.status === "Active").length,
    copies: db.book_copies.length,
    loans: db.borrowed_books.filter((l) => l.status === "Borrowed").length,
    overdue: db.borrowed_books.filter(isOverdue).length,
    pendingRequests: db.borrow_requests.filter((r) => r.status === "Pending").length,
    reservations: db.reservations.filter((r) => r.status === "Waiting" || (r.status === "Ready" && r.expires_at !== null && new Date(r.expires_at).getTime() >= Date.now())).length,
  };
}

export function adminCharts() {
  const db = getDb();
  const books = indexBy(db.books, "book_id");
  const cats = indexBy(db.categories, "category_id");
  const users = indexBy(db.users, "user_id");
  const days = Array.from({ length: 7 }, (_, i) => todayStr(i - 6));
  const open = db.borrowed_books.filter((l) => l.status === "Borrowed");
  return {
    issued: days.map((d): ChartRow => ({ label: d.slice(5), value: db.borrowed_books.filter((l) => localDate(l.borrow_date) === d).length })),
    returned: days.map((d): ChartRow => ({ label: d.slice(5), value: db.returned_books.filter((r) => localDate(r.return_date) === d).length })),
    categories: countBy(db.borrowed_books, (l) => cats[books[l.book_id].category_id]?.category_name ?? "—"),
    currentVsOverdue: [
      { label: "On time", value: open.filter((l) => !isOverdue(l)).length },
      { label: "Overdue", value: open.filter(isOverdue).length },
    ] as ChartRow[],
    borrowers: countBy(db.borrowed_books, (l) => fullName(users[l.user_id])).slice(0, 5),
    inventory: (["Available", "Borrowed", "Maintenance", "Lost"] as const).map((s): ChartRow => ({ label: s, value: db.book_copies.filter((c) => c.status === s).length })),
    mostBorrowed: countBy(db.borrowed_books, (l) => books[l.book_id].title).slice(0, 10),
  };
}

export function adminAlerts() {
  const db = getDb();
  const now = Date.now();
  const alerts: string[] = [];
  const overdue = db.borrowed_books.filter(isOverdue).length;
  if (overdue) alerts.push(`${overdue} overdue loan${overdue === 1 ? "" : "s"}`);
  const lost = db.book_copies.filter((c) => c.status === "Lost").length;
  if (lost) alerts.push(`${lost} lost cop${lost === 1 ? "y" : "ies"}`);
  const oldPen = db.penalties.filter((p) => p.status === "Unpaid" && now - ts(p.created_at) > ALERT_PENALTY_DAYS * 864e5).length;
  if (oldPen) alerts.push(`${oldPen} unpaid penalt${oldPen === 1 ? "y" : "ies"} older than ${ALERT_PENALTY_DAYS} days`);
  const oldSign = db.signups.filter((s) => s.status === "For Review" && now - ts(s.submitted_at) > ALERT_SIGNUP_DAYS * 864e5).length;
  if (oldSign) alerts.push(`${oldSign} signup${oldSign === 1 ? "" : "s"} waiting over ${ALERT_SIGNUP_DAYS} days`);
  const tasks: string[] = [];
  const review = db.signups.filter((s) => s.status === "For Review" || s.status === "Needs Info").length;
  if (review) tasks.push(`${review} signup${review === 1 ? "" : "s"} to review or awaiting info`);
  const ending = db.suspensions.filter((s) => s.status === "Active" && s.end_date && s.end_date >= todayStr() && s.end_date <= todayStr(7)).length;
  if (ending) tasks.push(`${ending} suspension${ending === 1 ? "" : "s"} ending within 7 days`);
  return { alerts, tasks };
}

const SIGNUP_VERB: Partial<Record<SignupStatus, string>> = { Approved: "approved", Rejected: "rejected", "Needs Info": "requested more info for" };

// System Activity: built from the existing who/when columns (no audit_logs table).
export function activityFeed(): ActivityEvent[] {
  const db = getDb();
  const users = indexBy(db.users, "user_id");
  const books = indexBy(db.books, "book_id");
  const loans = indexBy(db.borrowed_books, "borrow_id");
  const name = (id: number) => fullName(users[id]);
  const title = (id: number) => books[id]?.title ?? "a book";
  const ev: { id: string; date: string; actor_id: number; kind: ActivityKind; text: string }[] = [];
  const add = (id: string, date: string | null, actor: number | null, kind: ActivityKind, text: string) => {
    if (date && actor) ev.push({ id, date, actor_id: actor, kind, text });
  };

  db.borrowed_books.forEach((l) => add(`loan-${l.borrow_id}`, l.borrow_date, l.issued_by, "Lending", `issued “${title(l.book_id)}” to ${name(l.user_id)}`));
  db.returned_books.forEach((r) => {
    const l = loans[r.borrow_id];
    add(`ret-${r.return_id}`, r.return_date, r.received_by, "Returns", `received “${title(l.book_id)}” from ${name(l.user_id)} (${r.condition_status})`);
  });
  db.borrow_requests.forEach((r) =>
    add(`req-${r.request_id}`, r.reviewed_at, r.reviewed_by, "Requests", `${r.status === "Rejected" ? "rejected" : "approved"} ${name(r.user_id)}'s request for “${title(r.book_id)}”`),
  );
  db.penalties.forEach((p) => {
    add(`pen-c-${p.penalty_id}`, p.created_at, p.created_by, "Penalties", `created a ${p.penalty_type} penalty of ${p.amount.toFixed(2)} for ${name(p.user_id)}`);
    add(`pen-p-${p.penalty_id}`, p.paid_at, p.received_by, "Penalties", `recorded payment (${p.receipt_no}) from ${name(p.user_id)}`);
    add(`pen-w-${p.penalty_id}`, p.waived_at, p.waived_by, "Penalties", `waived ${name(p.user_id)}'s ${p.penalty_type} penalty`);
  });
  db.suspensions.forEach((s) => {
    add(`sus-s-${s.suspension_id}`, s.start_date.length === 10 ? `${s.start_date}T00:00:00` : s.start_date, s.suspended_by, "Suspensions", `suspended ${name(s.user_id)} (${s.reason_type})`);
    add(`sus-l-${s.suspension_id}`, s.lifted_at, s.lifted_by, "Suspensions", `lifted ${name(s.user_id)}'s suspension`);
  });
  db.signups.forEach((s) => add(`sig-${s.signup_id}`, s.reviewed_at, s.reviewed_by, "Signups", `${SIGNUP_VERB[s.status] ?? "reviewed"} signup ${s.reference_no}`));
  return ev
    .map((e): ActivityEvent => ({ ...e, who: name(e.actor_id), when: fmtDateTime(e.date), time: new Date(e.date).getTime() }))
    .sort((a, b) => b.time - a.time);
}

// ----- Reports -----
export const REPORTS: [ReportKey, string][] = [
  ["current", "Current borrowed"],
  ["overdue", "Overdue"],
  ["returned", "Returned"],
  ["lostDamaged", "Lost / Damaged"],
  ["history", "Borrowing history"],
  ["mostBorrowed", "Most borrowed"],
  ["inventory", "Inventory"],
  ["category", "Category statistics"],
  ["userActivity", "User activity"],
];

const LOAN_COLS: ReportColumn[] = [
  { key: "student", label: "Student" },
  { key: "book", label: "Book" },
  { key: "copy", label: "Copy" },
  { key: "borrowed", label: "Borrowed" },
  { key: "due", label: "Due" },
  { key: "status", label: "Status" },
];

export function runReport(key: ReportKey, from: string, to: string): ReportResult {
  const db = getDb();
  const users = indexBy(db.users, "user_id");
  const books = indexBy(db.books, "book_id");
  const copies = indexBy(db.book_copies, "copy_id");
  const loans = indexBy(db.borrowed_books, "borrow_id");
  const cats = indexBy(db.categories, "category_id");
  const loanRow = (l: (typeof db.borrowed_books)[number]): ReportRow => ({
    id: l.borrow_id,
    student: fullName(users[l.user_id]),
    book: books[l.book_id].title,
    copy: copies[l.copy_id].accession_no,
    borrowed: fmtDate(l.borrow_date),
    due: fmtDate(l.due_date),
    status: loanStatus(l),
  });

  switch (key) {
    case "current":
      return { columns: LOAN_COLS, rows: db.borrowed_books.filter((l) => l.status === "Borrowed" && inRange(l.borrow_date, from, to)).map(loanRow) };
    case "overdue":
      return {
        columns: [...LOAN_COLS.slice(0, 3), LOAN_COLS[4], { key: "late", label: "Days overdue" }],
        rows: db.borrowed_books
          .filter((l) => isOverdue(l) && inRange(`${l.due_date}T12:00:00`, from, to))
          .map((l): ReportRow => ({ ...loanRow(l), late: daysOverdue(l.due_date) }))
          .sort((a, b) => Number(b.late) - Number(a.late)),
      };
    case "returned":
      return {
        columns: [LOAN_COLS[0], LOAN_COLS[1], LOAN_COLS[2], { key: "returned", label: "Returned" }, { key: "condition", label: "Condition" }, { key: "late", label: "Days overdue" }],
        rows: db.returned_books
          .filter((r) => inRange(r.return_date, from, to))
          .map((r): ReportRow => {
            const l = loans[r.borrow_id];
            return { id: r.return_id, student: fullName(users[l.user_id]), book: books[l.book_id].title, copy: copies[l.copy_id].accession_no, returned: fmtDate(r.return_date), condition: r.condition_status, late: r.days_overdue };
          }),
      };
    case "lostDamaged":
      return {
        columns: [{ key: "type", label: "Type" }, { key: "book", label: "Book" }, { key: "copy", label: "Copy" }, { key: "student", label: "Student" }, { key: "date", label: "Date" }],
        rows: [
          ...db.borrowed_books
            .filter((l) => l.status === "Lost" && inRange(l.lost_at, from, to))
            .map((l): ReportRow => ({ id: `L${l.borrow_id}`, type: "Lost loan", book: books[l.book_id].title, copy: copies[l.copy_id].accession_no, student: fullName(users[l.user_id]), date: fmtDate(l.lost_at) })),
          ...db.returned_books
            .filter((r) => r.condition_status === "Damaged" && inRange(r.return_date, from, to))
            .map((r): ReportRow => {
              const l = loans[r.borrow_id];
              return { id: `D${r.return_id}`, type: "Damaged return", book: books[l.book_id].title, copy: copies[l.copy_id].accession_no, student: fullName(users[l.user_id]), date: fmtDate(r.return_date) };
            }),
          // copies currently out of circulation are always listed (they have no date range)
          ...db.book_copies
            .filter((c) => c.status === "Maintenance" || c.status === "Lost")
            .map((c): ReportRow => ({ id: `C${c.copy_id}`, type: `Copy ${c.status}`, book: books[c.book_id].title, copy: c.accession_no, student: "—", date: "—" })),
        ],
      };
    case "history":
      return {
        columns: [...LOAN_COLS, { key: "returned", label: "Returned" }],
        rows: db.borrowed_books
          .filter((l) => inRange(l.borrow_date, from, to))
          .map((l): ReportRow => {
            const r = db.returned_books.find((x) => x.borrow_id === l.borrow_id);
            return { ...loanRow(l), returned: r ? fmtDate(r.return_date) : l.lost_at ? "Lost" : "—" };
          }),
      };
    case "mostBorrowed":
      return {
        columns: [{ key: "title", label: "Title" }, { key: "author", label: "Author" }, { key: "category", label: "Category" }, { key: "count", label: "Loans" }],
        rows: countBy(db.borrowed_books.filter((l) => inRange(l.borrow_date, from, to)), (l) => l.book_id).map(
          ({ label: bid, value }): ReportRow => ({ id: bid, title: books[bid].title, author: books[bid].author, category: cats[books[bid].category_id]?.category_name ?? "—", count: value }),
        ),
      };
    case "inventory": {
      const row = (id: number | string, title: string, list: typeof db.book_copies): ReportRow => ({
        id,
        title,
        total: list.length,
        Available: list.filter((c) => c.status === "Available").length,
        Borrowed: list.filter((c) => c.status === "Borrowed").length,
        Maintenance: list.filter((c) => c.status === "Maintenance").length,
        Lost: list.filter((c) => c.status === "Lost").length,
      });
      return {
        columns: [{ key: "title", label: "Book" }, { key: "total", label: "Total" }, { key: "Available", label: "Available" }, { key: "Borrowed", label: "Borrowed" }, { key: "Maintenance", label: "Maintenance" }, { key: "Lost", label: "Lost" }],
        rows: [...db.books.map((b) => row(b.book_id, b.title, db.book_copies.filter((c) => c.book_id === b.book_id))), row("all", "All books", db.book_copies)],
      };
    }
    case "category":
      return {
        columns: [{ key: "name", label: "Category" }, { key: "books", label: "Books" }, { key: "copies", label: "Copies" }, { key: "loans", label: "Loans" }],
        rows: db.categories.map((c): ReportRow => {
          const ids = db.books.filter((b) => b.category_id === c.category_id).map((b) => b.book_id);
          return {
            id: c.category_id,
            name: c.category_name,
            books: ids.length,
            copies: db.book_copies.filter((x) => ids.includes(x.book_id)).length,
            loans: db.borrowed_books.filter((l) => ids.includes(l.book_id) && inRange(l.borrow_date, from, to)).length,
          };
        }),
      };
    case "userActivity":
      return {
        columns: [{ key: "name", label: "Student" }, { key: "loans", label: "Loans" }, { key: "requests", label: "Requests" }, { key: "reservations", label: "Reservations" }, { key: "penalties", label: "Penalties" }],
        rows: db.users
          .filter((u) => u.role === "Student")
          .map((u): ReportRow => ({
            id: u.user_id,
            name: fullName(u),
            loans: db.borrowed_books.filter((l) => l.user_id === u.user_id && inRange(l.borrow_date, from, to)).length,
            requests: db.borrow_requests.filter((r) => r.user_id === u.user_id && inRange(r.request_date, from, to)).length,
            reservations: db.reservations.filter((r) => r.user_id === u.user_id && inRange(r.reservation_date, from, to)).length,
            penalties: db.penalties.filter((p) => p.user_id === u.user_id && inRange(p.created_at, from, to)).length,
          }))
          .sort((a, b) => Number(b.loans) - Number(a.loans)),
      };
  }
}