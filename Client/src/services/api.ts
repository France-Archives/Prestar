// src/services/api.ts
import { SEED } from "../data/mockData";
import type {
  ApiResult,
  AppNotification,
  AvailabilityInfo,
  Book,
  BookActionState,
  BookCopy,
  BookFormData,
  BorrowedBook,
  BorrowRequest,
  Category,
  CopyStatus,
  CopyUpdate,
  Database,
  EligibilityAction,
  EligibilityIssue,
  LibrarianFormData,
  MatchStatus,
  Penalty,
  PenaltyType,
  PublicUser,
  RegisterFormData,
  RenewalState,
  Reservation,
  ReturnFormData,
  Signup,
  SignupDecision,
  SignupLookup,
  Suspension,
  SuspensionReason,
  User,
  UserRole,
  UserStatus,
  VerificationAction,
} from "../types";
import { CONFIG } from "../utils/constants";
import { addDaysToDate, daysOverdue, fmtDate, nowIso, todayStr } from "../utils/dates";
import { isStrongPassword } from "../utils/validators";

// MOCK API — REPLACE WITH REAL API CALL LATER
// This whole file simulates the backend: an in-memory copy of the database (saved to localStorage so a
// refresh keeps your changes), the business rules, and transactions (any failed action rolls back).
// Every async function returns { ok: true, data } or { ok: false, error }. Real endpoints would do the same.
// The sync read helpers below (freeToRequest, checkEligibility, ...) become API responses later.

const KEY = "prestar_mock_db_v2";

function load(): Database {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Database;
      if (parsed?.users) return parsed;
    }
  } catch {
    /* fall back to the seed */
  }
  return structuredClone(SEED);
}

let db: Database = load();
const listeners = new Set<() => void>();

// New array for every table so React sees a new snapshot.
const copyTables = (d: Database): Database => ({
  university_students: [...d.university_students],
  users: [...d.users],
  signups: [...d.signups],
  signup_verifications: [...d.signup_verifications],
  categories: [...d.categories],
  books: [...d.books],
  book_copies: [...d.book_copies],
  borrow_requests: [...d.borrow_requests],
  reservations: [...d.reservations],
  borrowed_books: [...d.borrowed_books],
  returned_books: [...d.returned_books],
  penalties: [...d.penalties],
  suspensions: [...d.suspensions],
});

// Replace every table array, persist, and notify subscribers.
function commit() {
  db = copyTables(db);
  localStorage.setItem(KEY, JSON.stringify(db));
  listeners.forEach((f) => f());
}
export const subscribe = (f: () => void): (() => void) => {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
};
export const getDb = (): Database => db;
export function resetMockData() {
  db = structuredClone(SEED);
  commit();
}

// ---------- plumbing ----------
class RuleError extends Error {}
// A function declaration with an explicit `never` return lets TypeScript narrow after `if (!x) fail(...)`.
function fail(msg: string): never {
  throw new RuleError(msg);
}
const wait = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms));

// Runs one "transaction": housekeeping, the action, commit. A rule violation rolls everything back.
async function run<T>(fn: () => T): Promise<ApiResult<T>> {
  await wait();
  const backup = structuredClone(db);
  try {
    housekeeping();
    const data = fn();
    commit();
    return { ok: true, data };
  } catch (e) {
    db = backup;
    commit();
    if (e instanceof RuleError) return { ok: false, error: e.message };
    throw e;
  }
}

const nextId = (ids: number[]) => ids.reduce((m, i) => Math.max(m, i), 0) + 1;
const userById = (id: number) => db.users.find((u) => u.user_id === id);
const bookById = (id: number) => db.books.find((b) => b.book_id === id);
const copyById = (id: number) => db.book_copies.find((c) => c.copy_id === id);
const requestById = (id: number) => db.borrow_requests.find((r) => r.request_id === id);
const reservationById = (id: number) => db.reservations.find((r) => r.reservation_id === id);
const loanById = (id: number) => db.borrowed_books.find((l) => l.borrow_id === id);
const penaltyById = (id: number) => db.penalties.find((p) => p.penalty_id === id);
const suspensionById = (id: number) => db.suspensions.find((s) => s.suspension_id === id);
const categoryById = (id: number) => db.categories.find((c) => c.category_id === id);
const signupById = (id: number) => db.signups.find((s) => s.signup_id === id);

export const publicUser = (u: User): PublicUser => ({
  user_id: u.user_id,
  student_id: u.student_id,
  first_name: u.first_name,
  last_name: u.last_name,
  email: u.email,
  role: u.role,
  status: u.status,
  manual_verified_until: u.manual_verified_until,
  created_at: u.created_at,
  updated_at: u.updated_at,
});
const money = (n: number | string) => Number(Number(n).toFixed(2));
const isFuture = (iso: string | null) => iso !== null && new Date(iso).getTime() >= Date.now();

function needRole(id: number, roles: UserRole[]): User {
  const u = userById(id);
  if (!u || u.status !== "Active" || !roles.includes(u.role)) fail("You do not have permission to do this.");
  return u;
}
const needStaff = (id: number) => needRole(id, ["Librarian", "Admin"]);
const needAdmin = (id: number) => needRole(id, ["Admin"]);
const needStudent = (id: number) => needRole(id, ["Student"]);

// ---------- derived values (never stored) ----------
export const isOverdue = (loan: BorrowedBook) => loan.status === "Borrowed" && loan.due_date < todayStr();

// Available copies minus units already promised to a Ready reservation or an Approved request.
export function freeToRequest(bookId: number): number {
  const avail = db.book_copies.filter((c) => c.book_id === bookId && c.status === "Available").length;
  const ready = db.reservations.filter((r) => r.book_id === bookId && r.status === "Ready" && isFuture(r.expires_at)).length;
  const approved = db.borrow_requests.filter((r) => r.book_id === bookId && r.status === "Approved" && isFuture(r.pickup_deadline)).length;
  return avail - ready - approved;
}

export function bookAvailability(bookId: number): AvailabilityInfo {
  const copies = db.book_copies.filter((c) => c.book_id === bookId);
  return {
    free: Math.max(0, freeToRequest(bookId)),
    circulating: copies.filter((c) => c.status !== "Lost").length,
    totalCopies: copies.length,
    queueLength: db.reservations.filter((r) => r.book_id === bookId && r.status === "Waiting").length,
  };
}

export const queuePosition = (r: Reservation): number =>
  1 +
  db.reservations.filter(
    (x) =>
      x.book_id === r.book_id &&
      x.status === "Waiting" &&
      (x.reservation_date < r.reservation_date || (x.reservation_date === r.reservation_date && x.reservation_id < r.reservation_id)),
  ).length;

// One function for conditions A–F (Part 10.2). Returns a list of reasons (empty = eligible).
// action: "request" | "reserve" | "renew" (A–D) | "promote" (A–E, no caps).
export function checkEligibility(uid: number, action: EligibilityAction = "request"): EligibilityIssue[] {
  const u = userById(uid);
  const out: EligibilityIssue[] = [];
  const add = (code: EligibilityIssue["code"], message: string) => out.push({ code, message });
  if (!u || u.status !== "Active") {
    add("A", "Your account is inactive.");
    return out;
  }
  if (u.role !== "Student") {
    add("A", "Only students can borrow books.");
    return out;
  }
  if (u.student_id) {
    const s = db.university_students.find((x) => x.student_id === u.student_id);
    if (!s) add("B", "We cannot verify your enrollment right now. Please try again later.");
    else if (s.enrollment_status !== "Enrolled")
      add("B", "You are not currently enrolled, so you cannot start new borrowing. You can still return books and pay penalties.");
  } else if (!(u.manual_verified_until !== null && u.manual_verified_until >= todayStr())) {
    add("B", "Your temporary access has ended. Please contact the library.");
  }
  const sus = db.suspensions.find((s) => s.user_id === uid && s.status === "Active" && (!s.end_date || s.end_date >= todayStr()));
  if (sus) add("C", `Your borrowing is suspended${sus.end_date ? ` until ${fmtDate(sus.end_date)}` : ""} (${sus.reason_type}).`);
  if (db.penalties.some((p) => p.user_id === uid && p.status === "Unpaid"))
    add("D", "You have an unpaid penalty. Pay it at the library counter to borrow again.");
  if (action !== "renew" && db.borrowed_books.some((l) => l.user_id === uid && isOverdue(l))) add("E", "You have an overdue book. Return it first.");
  if (action === "request") {
    const slots =
      db.borrowed_books.filter((l) => l.user_id === uid && l.status === "Borrowed").length +
      db.borrow_requests.filter((r) => r.user_id === uid && ["Pending", "Approved"].includes(r.status)).length;
    if (slots >= CONFIG.MAX_ACTIVE_LOANS) add("F", "You have reached the maximum number of active loans and requests.");
  }
  if (action === "reserve") {
    const n = db.reservations.filter((r) => r.user_id === uid && ["Waiting", "Ready"].includes(r.status)).length;
    if (n >= CONFIG.MAX_ACTIVE_RESERVATIONS) add("F", "You have reached the maximum number of active reservations.");
  }
  return out;
}

// Which button the student sees for a title (Part 5.3). The frontend only displays this.
export function bookActionState(uid: number, bookId: number): BookActionState {
  const book = bookById(bookId);
  if (!book || book.status !== "Active") return { action: "unavailable", label: "Not available", disabled: true, reason: null };
  if (db.borrowed_books.some((l) => l.user_id === uid && l.book_id === bookId && l.status === "Borrowed"))
    return { action: "borrowed", label: "Borrowed", disabled: true, reason: "You currently have this book." };
  if (db.borrow_requests.some((r) => r.user_id === uid && r.book_id === bookId && ["Pending", "Approved"].includes(r.status)))
    return { action: "requested", label: "Requested", disabled: true, reason: "You already requested this book." };
  const res = db.reservations.find((r) => r.user_id === uid && r.book_id === bookId && ["Waiting", "Ready"].includes(r.status));
  if (res)
    return { action: "reserved", label: res.status === "Ready" ? "Ready for pickup" : `Reserved, position ${queuePosition(res)}`, disabled: true, reason: null };
  const { circulating } = bookAvailability(bookId);
  let action: "request" | "reserve";
  if (freeToRequest(bookId) > 0) action = "request";
  else if (circulating > 0) action = "reserve";
  else return { action: "unavailable", label: "Not available", disabled: true, reason: "No copies in circulation." };
  const blockers = checkEligibility(uid, action);
  return { action, label: action === "request" ? "Request" : "Reserve", disabled: blockers.length > 0, reason: blockers[0]?.message ?? null };
}

// Can this loan be renewed right now? (Part 3, workflow M)
export function renewalState(loan: BorrowedBook): RenewalState {
  if (loan.status !== "Borrowed") return { ok: false, reason: "This loan is closed." };
  if (isOverdue(loan)) return { ok: false, reason: "This book is overdue. Return it." };
  if (loan.renewal_count >= CONFIG.RENEWAL_LIMIT) return { ok: false, reason: "Renewal limit reached." };
  const blockers = checkEligibility(loan.user_id, "renew");
  if (blockers.length) return { ok: false, reason: blockers[0].message };
  // Only a student who could actually be promoted blocks the renewal. A Waiting student who is skipped
  // (not enrolled, suspended, unpaid penalty, overdue) would otherwise block renewals for that title forever.
  const someoneWaiting = db.reservations.some(
    (r) =>
      r.book_id === loan.book_id &&
      r.user_id !== loan.user_id &&
      (r.status === "Ready" || (r.status === "Waiting" && checkEligibility(r.user_id, "promote").length === 0)),
  );
  if (someoneWaiting) return { ok: false, reason: "Another student is waiting for this book. Please return it by the due date." };
  return { ok: true, reason: null };
}

// Derived notification feed (Decision C: no notifications table).
export function getNotifications(uid: number): AppNotification[] {
  const out: AppNotification[] = [];
  const title = (id: number) => bookById(id)?.title ?? "a book";
  db.borrow_requests
    .filter((r) => r.user_id === uid)
    .forEach((r) => {
      if (r.status === "Pending")
        out.push({ id: `req-${r.request_id}-P`, type: "request", title: "Request submitted", text: `Your request for “${title(r.book_id)}” is waiting for review.`, date: r.request_date, to: "/student/requests" });
      if (r.status === "Approved")
        out.push({ id: `req-${r.request_id}-A`, type: "request", title: "Ready to claim", text: `“${title(r.book_id)}” is approved. Pick it up before ${fmtDate(r.pickup_deadline)}.`, date: r.reviewed_at ?? r.request_date, to: "/student/requests" });
      if (r.status === "Rejected")
        out.push({ id: `req-${r.request_id}-R`, type: "request", title: "Request rejected", text: `“${title(r.book_id)}”: ${r.remarks ?? "no reason given"}`, date: r.reviewed_at ?? r.request_date, to: "/student/requests" });
    });
  db.reservations
    .filter((r) => r.user_id === uid && r.status === "Ready")
    .forEach((r) =>
      out.push({ id: `res-${r.reservation_id}-R`, type: "reservation", title: "Reservation ready", text: `“${title(r.book_id)}” is held for you until ${fmtDate(r.expires_at)}.`, date: r.ready_at ?? r.reservation_date, to: "/student/reservations" }),
    );
  db.borrowed_books
    .filter((l) => l.user_id === uid && l.status === "Borrowed")
    .forEach((l) => {
      if (isOverdue(l))
        out.push({ id: `loan-${l.borrow_id}-O`, type: "loan", title: "Overdue", text: `“${title(l.book_id)}” was due ${fmtDate(l.due_date)}. Return it to borrow again.`, date: nowIso(), to: "/student/borrowing" });
      else if (l.due_date <= todayStr(CONFIG.DUE_SOON_DAYS))
        out.push({ id: `loan-${l.borrow_id}-D`, type: "loan", title: "Due soon", text: `“${title(l.book_id)}” is due ${fmtDate(l.due_date)}.`, date: nowIso(), to: "/student/borrowing" });
    });
  db.penalties
    .filter((p) => p.user_id === uid && p.status === "Unpaid")
    .forEach((p) =>
      out.push({ id: `pen-${p.penalty_id}`, type: "penalty", title: "Penalty created", text: `${p.penalty_type} penalty of ${p.amount.toFixed(2)}. Pay at the library counter.`, date: p.created_at, to: "/student/borrowing" }),
    );
  db.suspensions
    .filter((s) => s.user_id === uid && s.status === "Active" && (!s.end_date || s.end_date >= todayStr()))
    .forEach((s) =>
      out.push({ id: `sus-${s.suspension_id}`, type: "suspension", title: "Borrowing suspended", text: `${s.reason_type}${s.end_date ? ` until ${fmtDate(s.end_date)}` : ""}.`, date: s.start_date, to: "/student/profile" }),
    );
  return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export const archiveImpact = (bookId: number) => ({
  requests: db.borrow_requests.filter((r) => r.book_id === bookId && ["Pending", "Approved"].includes(r.status)).length,
  reservations: db.reservations.filter((r) => r.book_id === bookId && ["Waiting", "Ready"].includes(r.status)).length,
});

// ---------- housekeeping + promotion ----------
// Lazy expiry (Approved past deadline, Ready past expires_at), then promote waiting students.
function housekeeping() {
  const now = Date.now();
  db.borrow_requests.forEach((r) => {
    if (r.status === "Approved" && r.pickup_deadline !== null && new Date(r.pickup_deadline).getTime() < now) r.status = "Expired";
  });
  db.reservations.forEach((r) => {
    if (r.status === "Ready" && r.expires_at !== null && new Date(r.expires_at).getTime() < now) {
      r.status = "Expired";
      r.closed_at = nowIso();
    }
  });
  db.books.forEach((b) => promote(b.book_id));
}

// The single shared promotion function (return, cancel, expire, repair, add copy, archive all use it).
function promote(bookId: number) {
  const book = bookById(bookId);
  if (!book || book.status !== "Active") return;
  let free = freeToRequest(bookId);
  if (free <= 0) return;
  const waiting = db.reservations
    .filter((r) => r.book_id === bookId && r.status === "Waiting")
    .sort((a, b) => a.reservation_date.localeCompare(b.reservation_date) || a.reservation_id - b.reservation_id);
  for (const r of waiting) {
    if (free <= 0) break;
    if (checkEligibility(r.user_id, "promote").length) continue; // skipped, keeps its place
    r.status = "Ready";
    r.ready_at = nowIso();
    r.expires_at = nowIso(CONFIG.RESERVATION_HOLD_DAYS);
    free--;
  }
}

function cancelQueueIfNoCopies(bookId: number) {
  if (db.book_copies.some((c) => c.book_id === bookId && c.status !== "Lost")) return;
  db.reservations.forEach((r) => {
    if (r.book_id === bookId && ["Waiting", "Ready"].includes(r.status)) {
      r.status = "Cancelled";
      r.closed_at = nowIso();
      r.remarks = "All copies lost";
    }
  });
}

function cancelOpenForBook(bookId: number, remark: string) {
  db.reservations.forEach((r) => {
    if (r.book_id === bookId && ["Waiting", "Ready"].includes(r.status)) {
      r.status = "Cancelled";
      r.closed_at = nowIso();
      r.remarks = remark;
    }
  });
  db.borrow_requests.forEach((r) => {
    if (r.book_id === bookId && ["Pending", "Approved"].includes(r.status)) {
      r.status = "Cancelled";
      r.remarks = remark;
    }
  });
}

// ---------- authentication / registration ----------
export async function login(email: string, password: string): Promise<ApiResult<PublicUser>> {
  await wait();
  const u = db.users.find((x) => x.email === email.trim().toLowerCase());
  // MOCK AUTH — REPLACE WITH REAL BACKEND AUTHENTICATION LATER (compares plain text here; the backend verifies a hash)
  if (!u || u.password_hash !== password) return { ok: false, error: "Incorrect email or password." };
  if (u.status !== "Active") return { ok: false, error: "This account is inactive. Please contact the library." };
  return { ok: true, data: publicUser(u) };
}

const addVerification = (signupId: number, actorId: number | null, action: VerificationAction, remarks: string | null = null) =>
  db.signup_verifications.push({
    verification_id: nextId(db.signup_verifications.map((v) => v.verification_id)),
    signup_id: signupId,
    actor_id: actorId,
    action,
    remarks,
    action_date: nowIso(),
  });

// MOCK REGISTRATION — REPLACE WITH REAL BACKEND REGISTRATION LATER
// Creates a signup (not a user). Matched students are approved after email verification.
export const register = (f: RegisterFormData) =>
  run((): { reference_no: string; match_status: MatchStatus } => {
    const email = f.email.trim().toLowerCase();
    const sid = f.noStudentId ? null : f.studentId.trim() || null;
    if (db.users.some((u) => u.email === email || (sid && u.student_id === sid)))
      fail("An account already exists for this student or email. Try logging in or reset your password.");
    if (db.signups.some((s) => s.email === email && ["Pending", "For Review", "Needs Info"].includes(s.status)))
      fail("An application with this email is already in progress.");
    const reg = sid ? db.university_students.find((s) => s.student_id === sid) : undefined;
    // Decision A: middle name and suffix are folded into the two existing columns.
    const first_name = [f.firstName.trim(), f.middleName.trim()].filter(Boolean).join(" ");
    const last_name = [f.lastName.trim(), f.suffix.trim()].filter(Boolean).join(" ");
    const matched = !!reg && reg.email.toLowerCase() === email && !["Transferee", "Returnee"].includes(f.studentType);
    const id = nextId(db.signups.map((s) => s.signup_id));
    const signup: Signup = {
      signup_id: id,
      reference_no: `APP-${new Date().getFullYear()}-${String(id).padStart(4, "0")}`,
      student_id: reg ? reg.student_id : null,
      submitted_student_no: sid,
      first_name,
      last_name,
      email,
      password_hash: f.password,
      submitted_course: f.course.trim() || null,
      submitted_year_level: f.yearLevel ? Number(f.yearLevel) : null,
      student_type: f.studentType,
      previous_school: f.studentType === "Transferee" ? f.previousSchool.trim() || null : null,
      match_status: matched ? "Matched" : "Unmatched",
      verification_type: matched ? "Auto" : "Manual",
      email_verified_at: null,
      proof_file: null,
      status: "Pending",
      submitted_at: nowIso(),
      reviewed_by: null,
      reviewed_at: null,
      remarks: null,
      created_user_id: null,
    };
    db.signups.push(signup);
    addVerification(id, null, "Submitted");
    return { reference_no: signup.reference_no, match_status: signup.match_status };
  });

export const getSignupByReference = (ref: string): SignupLookup | null => {
  const s = db.signups.find((x) => x.reference_no === ref);
  return s
    ? { reference_no: s.reference_no, email: s.email, first_name: s.first_name, match_status: s.match_status, status: s.status, email_verified_at: s.email_verified_at, remarks: s.remarks }
    : null;
};

function createUserFromSignup(
  s: Signup,
  extra: { student_id: string | null; manual_verified_until: string | null },
  actorId: number | null,
  remarks: string | null = null,
) {
  if (db.users.some((u) => u.email === s.email)) fail("Email already in use.");
  const user: User = {
    user_id: nextId(db.users.map((u) => u.user_id)),
    student_id: extra.student_id,
    first_name: s.first_name,
    last_name: s.last_name,
    email: s.email,
    password_hash: s.password_hash,
    role: "Student",
    status: "Active",
    manual_verified_until: extra.manual_verified_until,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.users.push(user);
  s.status = "Approved";
  s.created_user_id = user.user_id;
  if (actorId) {
    s.reviewed_by = actorId;
    s.reviewed_at = nowIso();
    s.remarks = remarks;
  }
  addVerification(s.signup_id, actorId, "Approved", remarks);
}

// MOCK REGISTRATION — the real flow validates a signed, expiring token sent by email (the token here is the reference number)
export const verifyEmail = (token: string) =>
  run(() => {
    const s = db.signups.find((x) => x.reference_no === token);
    if (!s) fail("This link has expired or is invalid.");
    if (s.email_verified_at) return { alreadyVerified: true };
    s.email_verified_at = nowIso();
    if (s.match_status === "Matched") createUserFromSignup(s, { student_id: s.student_id, manual_verified_until: null }, null);
    return { alreadyVerified: false };
  });

export const uploadProof = (ref: string, fileName: string) =>
  run(() => {
    const s = db.signups.find((x) => x.reference_no === ref);
    if (!s || s.match_status !== "Unmatched" || !s.email_verified_at || !["Pending", "Needs Info"].includes(s.status))
      fail("Proof cannot be uploaded for this application.");
    if (s.status === "Needs Info") addVerification(s.signup_id, null, "Resubmitted");
    s.proof_file = fileName;
    s.status = "For Review";
  });

export const changePassword = (userId: number, current: string, next: string) =>
  run(() => {
    const u = userById(userId);
    if (!u) fail("Account not found.");
    if (u.password_hash !== current) fail("Current password is incorrect."); // MOCK AUTH
    if (!isStrongPassword(next)) fail("New password must be at least 8 characters with a letter and a number.");
    u.password_hash = next;
    u.updated_at = nowIso();
  });

// ---------- student actions ----------
const holdsBook = (userId: number, bookId: number) =>
  db.borrowed_books.some((l) => l.user_id === userId && l.book_id === bookId && l.status === "Borrowed");
const hasOpenRequest = (userId: number, bookId: number) =>
  db.borrow_requests.some((r) => r.user_id === userId && r.book_id === bookId && ["Pending", "Approved"].includes(r.status));
const hasOpenReservation = (userId: number, bookId: number) =>
  db.reservations.some((r) => r.user_id === userId && r.book_id === bookId && ["Waiting", "Ready"].includes(r.status));

export const createRequest = (userId: number, bookId: number) =>
  run(() => {
    needStudent(userId);
    const book = bookById(bookId);
    if (!book || book.status !== "Active") fail("This book is no longer available.");
    const blockers = checkEligibility(userId, "request");
    if (blockers.length) fail(blockers[0].message);
    if (holdsBook(userId, bookId)) fail("You currently have this book.");
    if (hasOpenRequest(userId, bookId)) fail("You already have an active request for this book.");
    if (hasOpenReservation(userId, bookId)) fail("You are already in the queue for this book.");
    if (freeToRequest(bookId) <= 0) fail("No copy is free any more. You can reserve this book instead.");
    db.borrow_requests.push({
      request_id: nextId(db.borrow_requests.map((r) => r.request_id)),
      user_id: userId,
      book_id: bookId,
      request_date: nowIso(),
      pickup_deadline: null,
      status: "Pending",
      reviewed_by: null,
      reviewed_at: null,
      remarks: null,
    });
  });

export const cancelRequest = (userId: number, requestId: number) =>
  run(() => {
    const r = requestById(requestId);
    if (!r || r.user_id !== userId) fail("Request not found.");
    if (!["Pending", "Approved"].includes(r.status)) fail("This can no longer be cancelled.");
    r.status = "Cancelled";
    promote(r.book_id);
  });

export const createReservation = (userId: number, bookId: number) =>
  run(() => {
    needStudent(userId);
    const book = bookById(bookId);
    if (!book || book.status !== "Active") fail("This book is no longer available.");
    const blockers = checkEligibility(userId, "reserve");
    if (blockers.length) fail(blockers[0].message);
    if (freeToRequest(bookId) > 0) fail("A copy is available. You can request it now.");
    if (!bookAvailability(bookId).circulating) fail("No copies in circulation.");
    if (holdsBook(userId, bookId)) fail("You currently have this book.");
    if (hasOpenRequest(userId, bookId)) fail("You already requested this book.");
    if (hasOpenReservation(userId, bookId)) fail("You are already in the queue.");
    db.reservations.push({
      reservation_id: nextId(db.reservations.map((r) => r.reservation_id)),
      user_id: userId,
      book_id: bookId,
      reservation_date: nowIso(),
      ready_at: null,
      expires_at: null,
      status: "Waiting",
      closed_at: null,
      remarks: null,
    });
  });

// Student cancels their own; staff may cancel any with a remark.
export const cancelReservation = (actorId: number, reservationId: number, remark: string | null = null) =>
  run(() => {
    const actor = userById(actorId);
    const r = reservationById(reservationId);
    if (!actor || !r) fail("Reservation not found.");
    const staff = actor.role === "Librarian" || actor.role === "Admin";
    if (!staff && r.user_id !== actorId) fail("Reservation not found.");
    if (staff && !remark?.trim()) fail("A remark is required.");
    if (!["Waiting", "Ready"].includes(r.status)) fail("This can no longer be cancelled.");
    r.status = "Cancelled";
    r.closed_at = nowIso();
    r.remarks = staff ? (remark?.trim() ?? null) : null;
    promote(r.book_id);
  });

export const renewLoan = (userId: number, borrowId: number) =>
  run(() => {
    const l = loanById(borrowId);
    if (!l || l.user_id !== userId) fail("Loan not found.");
    const s = renewalState(l);
    if (!s.ok) fail(s.reason ?? "Renewal is not possible.");
    l.due_date = addDaysToDate(l.due_date, CONFIG.RENEWAL_DAYS);
    l.renewal_count += 1;
    return l.due_date;
  });

// ---------- librarian / admin: lending desk ----------
export const approveRequest = (staffId: number, requestId: number) =>
  run(() => {
    const staff = needStaff(staffId);
    const r = requestById(requestId);
    if (!r || r.status !== "Pending") fail("This request was already processed.");
    const blockers = checkEligibility(r.user_id, "promote");
    if (blockers.length) fail(`This student can no longer borrow: ${blockers[0].message}`);
    if (freeToRequest(r.book_id) <= 0) fail("No free copy. Reject, or leave Pending.");
    r.status = "Approved";
    r.reviewed_by = staff.user_id;
    r.reviewed_at = nowIso();
    r.pickup_deadline = nowIso(CONFIG.PICKUP_HOLD_DAYS);
  });

export const rejectRequest = (staffId: number, requestId: number, reason: string) =>
  run(() => {
    const staff = needStaff(staffId);
    if (!reason.trim()) fail("A reason is required.");
    const r = requestById(requestId);
    if (!r || r.status !== "Pending") fail("This request was already processed.");
    r.status = "Rejected";
    r.reviewed_by = staff.user_id;
    r.reviewed_at = nowIso();
    r.remarks = reason.trim().slice(0, 255);
  });

// Hand-over: the ONLY place a loan is created. user_id and book_id are copied from the source row.
export const issueLoan = (staffId: number, p: { requestId?: number; reservationId?: number; accessionNo: string }) =>
  run((): BorrowedBook => {
    const staff = needStaff(staffId);
    const req: BorrowRequest | undefined = p.requestId ? requestById(p.requestId) : undefined;
    const res: Reservation | undefined = !p.requestId && p.reservationId ? reservationById(p.reservationId) : undefined;
    if (!req && !res) fail("Request or reservation not found.");
    const src = req ?? res;
    if (!src) fail("Request or reservation not found.");
    const valid = req ? req.status === "Approved" && isFuture(req.pickup_deadline) : res?.status === "Ready" && isFuture(res.expires_at);
    if (!valid) fail(req ? "This request has expired." : "This reservation is no longer ready.");
    const blockers = checkEligibility(src.user_id, "promote");
    if (blockers.length) fail(`This student can no longer borrow: ${blockers[0].message}`);

    // A reservation skips the request step, so the loan cap (condition F) was never checked for it.
    // A request is already counted in the student's slots, so only a reservation can push past the limit.
    if (res) {
      const slots =
        db.borrowed_books.filter((l) => l.user_id === src.user_id && l.status === "Borrowed").length +
        db.borrow_requests.filter((r) => r.user_id === src.user_id && (r.status === "Pending" || r.status === "Approved")).length;
      if (slots >= CONFIG.MAX_ACTIVE_LOANS) fail("This student has reached the maximum number of active loans and requests.");
    }

    const copy = db.book_copies.find((c) => c.accession_no === p.accessionNo.trim());
    if (!copy) fail("Accession number not found.");
    if (copy.book_id !== src.book_id) fail("This copy belongs to a different book.");
    if (copy.status !== "Available") fail("This copy is no longer available. Scan another copy.");
    copy.status = "Borrowed";
    const loan: BorrowedBook = {
      borrow_id: nextId(db.borrowed_books.map((l) => l.borrow_id)),
      request_id: req ? req.request_id : null,
      reservation_id: res ? res.reservation_id : null,
      user_id: src.user_id,
      book_id: src.book_id,
      copy_id: copy.copy_id,
      borrow_date: nowIso(),
      due_date: addDaysToDate(todayStr(), CONFIG.LOAN_DAYS),
      renewal_count: 0,
      status: "Borrowed",
      issued_by: staff.user_id,
      lost_at: null,
    };
    db.borrowed_books.push(loan);
    if (req) req.status = "Issued";
    if (res) {
      res.status = "Fulfilled";
      res.closed_at = nowIso();
    }
    return loan;
  });

function addPenalty(loan: BorrowedBook, type: PenaltyType, amount: number | string, staffId: number, remarks: string | null = null): number {
  const a = money(amount);
  if (!(a > 0)) fail("Penalty amount must be greater than 0.");
  const penalty: Penalty = {
    penalty_id: nextId(db.penalties.map((p) => p.penalty_id)),
    borrow_id: loan.borrow_id,
    user_id: loan.user_id,
    penalty_type: type,
    amount: a,
    status: "Unpaid",
    created_at: nowIso(),
    created_by: staffId,
    paid_at: null,
    received_by: null,
    receipt_no: null,
    waived_by: null,
    waived_at: null,
    waive_remarks: null,
    remarks,
  };
  db.penalties.push(penalty);
  return a;
}

// Returns are never blocked by suspension, penalty, overdue or enrollment.
export const returnLoan = (staffId: number, f: ReturnFormData) =>
  run(() => {
    const staff = needStaff(staffId);
    const loan = loanById(f.borrowId);
    if (!loan || loan.status !== "Borrowed") fail("Already returned.");
    const copy = copyById(loan.copy_id);
    if (!copy) fail("Copy not found.");
    if (f.scannedAccessionNo && f.scannedAccessionNo.trim() !== copy.accession_no) fail("This copy is not on this loan.");
    if (f.condition !== "Good" && f.condition !== "Damaged") fail("Choose a condition.");
    const late = daysOverdue(loan.due_date);
    db.returned_books.push({
      return_id: nextId(db.returned_books.map((r) => r.return_id)),
      borrow_id: loan.borrow_id,
      received_by: staff.user_id,
      return_date: nowIso(),
      condition_status: f.condition,
      days_overdue: late,
      remarks: f.remarks?.trim() || null,
    });
    loan.status = "Returned";
    const penalties: { type: PenaltyType; amount: number }[] = [];
    if (late > 0) penalties.push({ type: "Overdue", amount: addPenalty(loan, "Overdue", late * CONFIG.OVERDUE_FINE_PER_DAY, staff.user_id) });
    if (f.condition === "Damaged") {
      copy.status = "Maintenance";
      copy.condition_status = "Damaged";
      if (f.damagedAmount !== undefined && f.damagedAmount !== "" && f.damagedAmount !== null)
        penalties.push({ type: "Damaged", amount: addPenalty(loan, "Damaged", f.damagedAmount, staff.user_id, f.remarks?.trim() || null) });
    } else {
      copy.status = "Available";
      copy.condition_status = "Good";
    }
    promote(loan.book_id);
    return { days_overdue: late, penalties };
  });

export const markLost = (staffId: number, p: { borrowId: number; amount?: number }) =>
  run(() => {
    const staff = needStaff(staffId);
    const loan = loanById(p.borrowId);
    if (!loan || loan.status !== "Borrowed") fail("Already closed.");
    const book = bookById(loan.book_id);
    const copy = copyById(loan.copy_id);
    if (!book || !copy) fail("Loan data is incomplete.");
    // A blank amount falls back to the book price. With no price either, say so clearly
    // instead of letting addPenalty fail with a generic message.
    const value = p.amount ?? book.price ?? 0;
    if (!(value > 0)) fail("This book has no price set. Enter the penalty amount.");
    loan.status = "Lost";
    loan.lost_at = nowIso();
    copy.status = "Lost";
    const a = addPenalty(loan, "Lost", value, staff.user_id);
    cancelQueueIfNoCopies(loan.book_id);
    return { amount: a };
  });

// ---------- penalties and suspensions ----------
export const payPenalty = (staffId: number, penaltyId: number, receiptNo: string) =>
  run(() => {
    const staff = needStaff(staffId);
    const receipt = receiptNo.trim();
    if (!receipt) fail("Receipt number is required.");
    if (db.penalties.some((p) => p.receipt_no === receipt)) fail("Receipt number already exists.");
    const p = penaltyById(penaltyId);
    if (!p || p.status !== "Unpaid") fail("Already paid.");
    p.status = "Paid";
    p.paid_at = nowIso();
    p.received_by = staff.user_id;
    p.receipt_no = receipt;
  });

export const waivePenalty = (staffId: number, penaltyId: number, remarks: string) =>
  run(() => {
    const staff = needStaff(staffId);
    if (!remarks.trim()) fail("A reason is required to waive a penalty.");
    const p = penaltyById(penaltyId);
    if (!p || p.status !== "Unpaid") fail("This penalty is not unpaid.");
    p.status = "Waived";
    p.waived_by = staff.user_id;
    p.waived_at = nowIso();
    p.waive_remarks = remarks.trim();
  });

const SUSPENSION_REASONS: SuspensionReason[] = ["Violation", "Lost Book", "Damaged Book", "Other"];

export const createSuspension = (
  staffId: number,
  p: { userId: number; reasonType: SuspensionReason; reasonDetails: string; borrowId?: number | null; endDate?: string },
) =>
  run(() => {
    const staff = needStaff(staffId);
    if (!SUSPENSION_REASONS.includes(p.reasonType)) fail("Choose a reason type.");
    if (!p.reasonDetails.trim()) fail("Details are required.");
    const target = userById(p.userId);
    if (!target || target.role !== "Student") fail("Student not found.");
    const start = todayStr();
    if (p.endDate && p.endDate < start) fail("End date cannot be before the start date.");
    const s: Suspension = {
      suspension_id: nextId(db.suspensions.map((x) => x.suspension_id)),
      user_id: p.userId,
      borrow_id: p.borrowId ?? null,
      reason_type: p.reasonType,
      reason_details: p.reasonDetails.trim(),
      suspended_by: staff.user_id,
      start_date: start,
      end_date: p.endDate || null,
      status: "Active",
      lifted_by: null,
      lifted_at: null,
      lift_remarks: null,
    };
    db.suspensions.push(s);
  });

export const liftSuspension = (staffId: number, suspensionId: number, remarks?: string) =>
  run(() => {
    const staff = needStaff(staffId);
    const s = suspensionById(suspensionId);
    if (!s || s.status !== "Active") fail("Already lifted.");
    s.status = "Lifted";
    s.lifted_by = staff.user_id;
    s.lifted_at = nowIso();
    s.lift_remarks = remarks?.trim() || null;
  });

// ---------- catalog and inventory (used by the Librarian pages, built next) ----------
export const saveBook = (staffId: number, f: BookFormData) =>
  run((): Book => {
    needStaff(staffId);
    if (!f.title.trim() || !f.author.trim()) fail("Title and author are required.");
    if (!categoryById(Number(f.category_id))) fail("Choose a category.");
    const isbn = f.isbn?.trim() || null;
    if (isbn && db.books.some((b) => b.isbn === isbn && b.book_id !== f.book_id))
      fail("A book with this ISBN already exists. A different edition needs its own record.");
    const price = f.price === "" || f.price == null ? null : Number(f.price);
    if (price !== null && !(price >= 0)) fail("Price must be 0 or more.");
    const fields = {
      title: f.title.trim(),
      author: f.author.trim(),
      isbn,
      category_id: Number(f.category_id),
      publisher: f.publisher?.trim() || null,
      year_published: f.year_published ? Number(f.year_published) : null,
      edition: f.edition?.trim() || null,
      description: f.description?.trim() || null,
      cover_image: f.cover_image?.trim() || null,
      shelf_location: f.shelf_location?.trim() || null,
      price,
      updated_at: nowIso(),
    };
    if (f.book_id) {
      const b = bookById(f.book_id);
      if (!b) fail("Book not found.");
      Object.assign(b, fields);
      return b;
    }
    const b: Book = {
      book_id: nextId(db.books.map((x) => x.book_id)),
      ...fields,
      status: "Active",
      color: "#3F566B", // UI-only placeholder
      created_at: nowIso(),
    };
    db.books.push(b);
    return b;
  });

export const archiveBook = (staffId: number, bookId: number) =>
  run(() => {
    needStaff(staffId);
    const b = bookById(bookId);
    if (!b || b.status === "Archived") fail("Already archived.");
    b.status = "Archived";
    b.updated_at = nowIso();
    cancelOpenForBook(bookId, "Book archived");
  });

export const restoreBook = (staffId: number, bookId: number) =>
  run(() => {
    needStaff(staffId);
    const b = bookById(bookId);
    if (!b) fail("Book not found.");
    b.status = "Active";
    b.updated_at = nowIso();
    promote(bookId);
  });

export const saveCategory = (staffId: number, f: { category_id?: number; category_name: string; description?: string }) =>
  run(() => {
    needStaff(staffId);
    const name = f.category_name.trim();
    if (!name) fail("Category name is required.");
    if (db.categories.some((c) => c.category_name.toLowerCase() === name.toLowerCase() && c.category_id !== f.category_id))
      fail("This category already exists.");
    const description = f.description?.trim() || null;
    if (f.category_id) {
      const c = categoryById(f.category_id);
      if (!c) fail("Category not found.");
      Object.assign(c, { category_name: name, description });
    } else {
      const c: Category = { category_id: nextId(db.categories.map((x) => x.category_id)), category_name: name, description };
      db.categories.push(c);
    }
  });

export const deleteCategory = (staffId: number, categoryId: number) =>
  run(() => {
    needStaff(staffId);
    const n = db.books.filter((b) => b.category_id === categoryId).length;
    if (n) fail(`In use by ${n} book${n === 1 ? "" : "s"}.`);
    db.categories = db.categories.filter((c) => c.category_id !== categoryId);
  });

export const addCopy = (staffId: number, p: { bookId: number; accessionNo: string; condition?: BookCopy["condition_status"] }) =>
  run(() => {
    needStaff(staffId);
    const acc = p.accessionNo.trim();
    if (!acc) fail("Accession number is required.");
    if (!bookById(p.bookId)) fail("Choose a book.");
    if (db.book_copies.some((c) => c.accession_no === acc)) fail("This accession number already exists.");
    db.book_copies.push({
      copy_id: nextId(db.book_copies.map((c) => c.copy_id)),
      book_id: p.bookId,
      accession_no: acc,
      condition_status: p.condition ?? "Good",
      status: "Available",
      created_at: nowIso(),
    });
    promote(p.bookId);
  });

const COPY_MOVES: Partial<Record<CopyStatus, CopyStatus[]>> = { Available: ["Maintenance", "Lost"], Maintenance: ["Available", "Lost"] };
export const updateCopy = (staffId: number, copyId: number, u: CopyUpdate) =>
  run(() => {
    needStaff(staffId);
    const c = copyById(copyId);
    if (!c) fail("Copy not found.");
    if (u.condition_status) {
      if (u.condition_status !== "Good" && u.condition_status !== "Damaged") fail("Invalid condition.");
      c.condition_status = u.condition_status;
    }
    if (u.status && u.status !== c.status) {
      if (!COPY_MOVES[c.status]?.includes(u.status)) fail("This action is not allowed for the current status.");
      c.status = u.status;
      if (u.status === "Lost") cancelQueueIfNoCopies(c.book_id);
    }
    promote(c.book_id);
  });

// ---------- admin ----------
export const createLibrarian = (adminId: number, f: LibrarianFormData) =>
  run(() => {
    needAdmin(adminId);
    const em = f.email.trim().toLowerCase();
    if (!f.firstName.trim() || !f.lastName.trim() || !em) fail("All fields are required.");
    if (db.users.some((u) => u.email === em)) fail("Email already in use.");
    if (!isStrongPassword(f.password)) fail("Initial password must be at least 8 characters with a letter and a number.");
    db.users.push({
      user_id: nextId(db.users.map((u) => u.user_id)),
      student_id: null,
      first_name: f.firstName.trim(),
      last_name: f.lastName.trim(),
      email: em,
      password_hash: f.password,
      role: "Librarian",
      status: "Active",
      manual_verified_until: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
  });

const activeAdmins = () => db.users.filter((u) => u.role === "Admin" && u.status === "Active").length;

export const setUserStatus = (adminId: number, userId: number, status: UserStatus) =>
  run(() => {
    needAdmin(adminId);
    const u = userById(userId);
    if (!u || !["Active", "Inactive"].includes(status)) fail("User not found.");
    if (status === "Inactive") {
      if (u.user_id === adminId) fail("You cannot deactivate your own account.");
      if (u.role === "Admin" && activeAdmins() <= 1) fail("You cannot deactivate the last remaining Admin.");
      const touched = new Set<number>();
      db.borrow_requests.forEach((r) => {
        if (r.user_id === userId && ["Pending", "Approved"].includes(r.status)) {
          r.status = "Cancelled";
          r.remarks = "Account set Inactive";
          touched.add(r.book_id);
        }
      });
      db.reservations.forEach((r) => {
        if (r.user_id === userId && ["Waiting", "Ready"].includes(r.status)) {
          r.status = "Cancelled";
          r.closed_at = nowIso();
          r.remarks = "Account set Inactive";
          touched.add(r.book_id);
        }
      });
      touched.forEach(promote);
    }
    u.status = status;
    u.updated_at = nowIso();
  });

export const changeRole = (adminId: number, userId: number, role: UserRole) =>
  run(() => {
    needAdmin(adminId);
    const u = userById(userId);
    if (!u || !["Student", "Librarian", "Admin"].includes(role)) fail("User not found.");
    if (u.user_id === adminId) fail("You cannot change your own role.");
    if (u.role === "Admin" && role !== "Admin" && activeAdmins() <= 1) fail("You cannot demote the last remaining Admin.");
    u.role = role;
    u.updated_at = nowIso();
  });

export const reviewSignup = (adminId: number, signupId: number, decision: SignupDecision, remarks?: string) =>
  run(() => {
    needAdmin(adminId);
    const s = signupById(signupId);
    if (!s || s.status !== "For Review") fail("This application is not waiting for review.");
    if (decision === "Approve") {
      // Provisional access: student_id stays NULL, time-limited. PRESTAR never writes to the university database.
      createUserFromSignup(s, { student_id: null, manual_verified_until: todayStr(CONFIG.MANUAL_ACCESS_DAYS) }, adminId, remarks?.trim() || null);
      return;
    }
    if (!remarks?.trim()) fail("Remarks are required.");
    s.reviewed_by = adminId;
    s.reviewed_at = nowIso();
    s.remarks = remarks.trim();
    if (decision === "Reject") {
      s.status = "Rejected";
      addVerification(s.signup_id, adminId, "Rejected", s.remarks);
    } else {
      s.status = "Needs Info";
      addVerification(s.signup_id, adminId, "Info Requested", s.remarks);
    }
  });