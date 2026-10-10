import type {
  AcademicTerm,
  AuthorSummary,
  BookAvailability,
  BookCopy,
  BookDetail,
  BookSummary,
  BookToRelease,
  BorrowingRequest,
  BorrowingRequestStatus,
  CopyRef,
  CorSummary,
  CorVerification,
  EffectiveCorStatus,
  ErrorCode,
  FineSummary,
  FineType,
  HandoverAction,
  Loan,
  NotificationItem,
  PenaltyCheck,
  PenaltyOverdueLoan,
  PenaltyReason,
  PenaltyUnpaidFine,
  Reservation,
  StaffBorrowingRequest,
  StaffFine,
  StaffLoan,
  StudentRef,
  UUID,
} from "@/types";
import type { MockAccount, MockBook, MockBorrowingRequest, MockCorRecord, MockFine, MockLoan, MockNotification, MockReservation } from "@/data";
import { FINE_AMOUNTS, POLICY_SETTINGS, statusLabel } from "@/utils/constants";
import { fail } from "@/utils/errors";
import { formatPeso, roundMoney } from "@/utils/formatCurrency";
import { addDaysIso, formatDate, overdueDays, todayKey } from "@/utils/formatDate";
import {
  accountByStudentId,
  audit,
  commit,
  db,
  latency,
  newId,
  notify,
  nowIso,
} from "./mockStore";

// TEMPORARY MOCK IMPLEMENTATION: the business-rule engine of the demo.
// Eligibility, copy assignment, queue offers, due dates, deadlines and fine amounts are decided by the BACKEND in
// the real system. This file only makes the demo behave like the spec. When the backend is connected, DELETE it
// and do not copy these rules into pages (Integration PDF §4: remove client-side business logic).

/** Start of every mock request: simulated latency, then the background jobs (expiry, offers) a real backend runs on a schedule. */
export async function begin(): Promise<void> {
  await latency();
  runJobs();
}

// ---------- settings (system_settings, Admin-editable) ----------
export function setting(key: string): number {
  const s = db.settings.find((x) => x.key === key);
  if (s && typeof s.value === "number") return s.value;
  return POLICY_SETTINGS.find((p) => p.key === key)?.defaultValue ?? 0;
}

// ---------- lookups and joins ----------
export const copyById = (id: UUID): BookCopy | undefined => db.copies.find((c) => c.id === id);
export const copyRef = (c: BookCopy): CopyRef => ({ id: c.id, barcode: c.barcode });

export function studentUserId(studentId: UUID): UUID {
  const a = accountByStudentId(studentId);
  if (!a) fail("NOT_FOUND", "Student not found.");
  return a.user.id;
}

export function studentRef(studentId: UUID): StudentRef {
  const s = accountByStudentId(studentId)?.student;
  if (!s) fail("NOT_FOUND", "Student not found.");
  return { id: s.id, studentNumber: s.studentNumber, firstName: s.firstName, lastName: s.lastName };
}

export function studentName(studentId: UUID): string {
  const s = studentRef(studentId);
  return `${s.firstName} ${s.lastName}`;
}

// ---------- books ----------
const usable = (c: BookCopy) => c.status === "AVAILABLE" || c.status === "RESERVED" || c.status === "ON_LOAN";

export function availabilityOf(bookId: UUID): BookAvailability {
  const copies = db.copies.filter((c) => c.bookId === bookId);
  return {
    availableCopies: copies.filter((c) => c.status === "AVAILABLE").length,
    totalUsableCopies: copies.filter(usable).length,
  };
}

export const authorsOf = (b: MockBook): AuthorSummary[] =>
  b.authorIds.map((id) => db.authors.find((a) => a.id === id)).filter((a): a is AuthorSummary => !!a);

export function toBookDetail(b: MockBook): BookDetail {
  const { categoryId, authorIds: _authorIds, ...rest } = b;
  return {
    ...rest,
    category: db.categories.find((c) => c.id === categoryId) ?? null,
    authors: authorsOf(b),
    availability: availabilityOf(b.id),
  };
}

export function toBookSummary(b: MockBook): BookSummary {
  const d = toBookDetail(b);
  return {
    id: d.id,
    isbn: d.isbn,
    title: d.title,
    description: d.description,
    category: d.category,
    authors: d.authors,
    availability: d.availability,
    coverImageUrl: d.coverImageUrl,
  };
}

// ---------- academic terms and COR ----------
export function currentTerm(): AcademicTerm | null {
  const today = todayKey();
  return db.terms.find((t) => t.status === "ACTIVE") ?? db.terms.find((t) => t.startDate <= today && today <= t.endDate) ?? null;
}

export function toCor(r: MockCorRecord): CorVerification {
  return {
    id: r.id,
    academicTermId: r.academicTermId,
    termName: r.termName,
    status: r.status,
    rejectionReason: r.rejectionReason,
    originalFileName: r.originalFileName,
    submittedAt: r.submittedAt,
    reviewedAt: r.reviewedAt,
    effectiveFrom: r.effectiveFrom,
    validUntil: r.validUntil,
  };
}

/** Effective COR for the CURRENT term only. A next-term approval stays NOT_YET_EFFECTIVE until the term starts. */
export function effectiveCor(studentId: UUID): EffectiveCorStatus {
  const today = todayKey();
  const term = currentTerm();
  const mine = db.cors.filter((c) => c.studentId === studentId);
  const approved = mine.filter((c) => c.status === "APPROVED");
  if (approved.some((c) => c.effectiveFrom && c.validUntil && c.effectiveFrom <= today && today <= c.validUntil)) return "APPROVED";
  if (term) {
    const latest = mine
      .filter((c) => c.academicTermId === term.id && c.status !== "SUPERSEDED")
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
    if (latest && latest.status !== "APPROVED") return latest.status;
  }
  if (approved.some((c) => c.effectiveFrom && c.effectiveFrom > today)) return "NOT_YET_EFFECTIVE";
  return approved.length ? "EXPIRED" : "MISSING";
}

export function corSummaryOf(studentId: UUID): CorSummary {
  const latest = db.cors.filter((c) => c.studentId === studentId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
  return { status: effectiveCor(studentId), currentTerm: currentTerm(), latest: latest ? toCor(latest) : null };
}

// ---------- commitments, overdue loans, fines ----------
// TC-13 baseline: ON_HOLD requests keep their copy, so they count toward the commitment limits. TO CONFIRM.
const OPEN_REQUEST: BorrowingRequestStatus[] = ["PENDING", "APPROVED", "ON_HOLD"];

/** Active commitment = active loan + approved/held request awaiting pickup + WAITING/OFFERED reservation. */
export function commitmentsOf(studentId: UUID, bookId?: UUID): number {
  const same = (id: UUID) => !bookId || id === bookId;
  return (
    db.loans.filter((l) => l.studentId === studentId && l.status === "ACTIVE" && same(l.bookId)).length +
    db.requests.filter((r) => r.studentId === studentId && OPEN_REQUEST.includes(r.status) && same(r.bookId)).length +
    db.reservations.filter((r) => r.studentId === studentId && (r.status === "WAITING" || r.status === "OFFERED") && same(r.bookId)).length
  );
}

/** Restriction applies only when a loan is MORE than the grace period (3 calendar days) overdue. */
export function overdueLoansOf(studentId: UUID): PenaltyOverdueLoan[] {
  const grace = setting("OVERDUE_GRACE_DAYS");
  return db.loans
    .filter((l) => l.studentId === studentId && l.status === "ACTIVE")
    .map((l) => ({ loanId: l.id, bookTitle: l.bookTitle, dueAt: l.dueAt, overdueDays: overdueDays(l.dueAt) }))
    .filter((l) => l.overdueDays > grace);
}

export const paidOf = (fineId: UUID): number =>
  roundMoney(db.payments.filter((p) => p.fineId === fineId).reduce((sum, p) => sum + p.amount, 0));

export function toFineSummary(f: MockFine): FineSummary {
  const paid = paidOf(f.id);
  return {
    id: f.id,
    fineType: f.fineType,
    amount: f.amount,
    paidAmount: paid,
    balance: f.status === "WAIVED" ? 0 : roundMoney(f.amount - paid),
    status: f.status,
    recordedAt: f.recordedAt,
  };
}

export function toStaffFine(f: MockFine): StaffFine {
  return { ...toFineSummary(f), student: studentRef(f.studentId), loanId: f.loanId, bookTitle: f.bookTitle, notes: f.notes };
}

export function unpaidFinesOf(studentId: UUID): PenaltyUnpaidFine[] {
  return db.fines
    .filter((f) => f.studentId === studentId && (f.status === "UNPAID" || f.status === "PARTIALLY_PAID"))
    .map((f) => {
      const s = toFineSummary(f);
      return { fineId: f.id, fineType: f.fineType, amount: s.amount, paidAmount: s.paidAmount, balance: s.balance };
    });
}

// ---------- eligibility (server-computed in the real system) ----------
export interface EligibilityOptions {
  /** true for new borrowing/reservations (10 / 2 limits). false for handover, renewal and penalty checks. */
  includeLimits?: boolean;
  bookId?: UUID;
}

export function checkEligibility(studentId: UUID, opts: EligibilityOptions = {}): PenaltyCheck {
  const account = accountByStudentId(studentId);
  if (!account) fail("NOT_FOUND", "Student not found.");
  const reasons: PenaltyReason[] = [];
  const add = (code: ErrorCode, message: string) => reasons.push({ code, message });

  const { accountStatus } = account.user;
  const emailVerified = account.user.emailVerifiedAt !== null;
  if (accountStatus === "DISABLED") add("ACCOUNT_DISABLED", "This account is disabled.");
  if (accountStatus === "SUSPENDED") add("ACCOUNT_SUSPENDED", "The account is suspended. New borrowing is blocked until it is reactivated.");
  if (!emailVerified) add("EMAIL_NOT_VERIFIED", "The email address has not been verified.");

  const cor = effectiveCor(studentId);
  if (cor === "EXPIRED") add("COR_EXPIRED", "The COR has expired. A COR for the current term is required.");
  else if (cor === "NOT_YET_EFFECTIVE") add("COR_NOT_YET_EFFECTIVE", "The approved COR is for a later term and is not in effect yet.");
  else if (cor !== "APPROVED") add("COR_REQUIRED", "An approved COR for the current academic term is required.");

  const overdue = overdueLoansOf(studentId);
  if (overdue.length) add("OVERDUE_GRACE_EXCEEDED", `${overdue.length === 1 ? "One loan is" : `${overdue.length} loans are`} overdue beyond the ${setting("OVERDUE_GRACE_DAYS")}-day grace period.`);
  const fines = unpaidFinesOf(studentId);
  if (fines.length) add("UNPAID_FINE", "An assessed fine has an unpaid balance.");

  const activeCommitmentCount = commitmentsOf(studentId);
  if (opts.includeLimits) {
    if (activeCommitmentCount >= setting("MAX_ACTIVE_COMMITMENTS")) add("COMMITMENT_LIMIT_REACHED", `The limit of ${setting("MAX_ACTIVE_COMMITMENTS")} active commitments has been reached.`);
    if (opts.bookId && commitmentsOf(studentId, opts.bookId) >= setting("MAX_ACTIVE_SAME_TITLE")) add("SAME_TITLE_LIMIT_REACHED", `The limit of ${setting("MAX_ACTIVE_SAME_TITLE")} active commitments for this title has been reached.`);
  }

  return {
    studentId,
    checkedAt: nowIso(),
    eligible: reasons.length === 0,
    accountStatus,
    emailVerified,
    corStatus: cor,
    activeCommitmentCount,
    reasons,
    overdueLoans: overdue,
    unpaidFines: fines,
  };
}

/** Throws the first restriction as a spec-shaped error (403). */
export function assertEligible(studentId: UUID, opts: EligibilityOptions = {}): PenaltyCheck {
  const check = checkEligibility(studentId, opts);
  const first = check.reasons[0];
  if (first) {
    const corIssue = first.code.startsWith("COR_");
    fail(first.code, first.message, 403, {
      reasons: check.reasons,
      ...(corIssue ? { requiredAction: "SUBMIT_COR" } : {}),
      canBrowseCatalog: true,
      canBorrow: false,
    });
  }
  return check;
}

// ---------- copies and the FIFO reservation queue ----------
const byFifo = (a: { reservedAt: string; id: string }, b: { reservedAt: string; id: string }) =>
  a.reservedAt.localeCompare(b.reservedAt) || a.id.localeCompare(b.id);

export function queuePosition(r: MockReservation): number {
  const waiting = db.reservations.filter((x) => x.bookId === r.bookId && x.status === "WAITING").sort(byFifo);
  return waiting.findIndex((x) => x.id === r.id) + 1;
}

/** Offer a free copy to the first ELIGIBLE waiting student. Ineligible students are skipped and keep their place (TO CONFIRM). */
export function offerCopyToQueue(copy: BookCopy): boolean {
  const queue = db.reservations.filter((r) => r.bookId === copy.bookId && r.status === "WAITING").sort(byFifo);
  for (const r of queue) {
    if (!checkEligibility(r.studentId).eligible) continue;
    r.status = "OFFERED";
    r.offeredCopyId = copy.id;
    r.pickupDeadline = addDaysIso(new Date(), setting("RESERVATION_HOLD_DAYS"));
    copy.status = "RESERVED";
    notify(studentUserId(r.studentId), "RESERVATION_OFFERED", "A copy is ready", `A copy of ${r.bookTitle} is held for you until ${formatDate(r.pickupDeadline)}.`, ["RESERVATION", r.id]);
    return true;
  }
  return false;
}

/** A held copy is freed (cancel, expiry, rejected handover): offer it to the queue or make it AVAILABLE. */
export function releaseCopy(copy: BookCopy): void {
  copy.status = "AVAILABLE";
  offerCopyToQueue(copy);
}

export function fillQueues(): void {
  for (const copy of db.copies) if (copy.status === "AVAILABLE") offerCopyToQueue(copy);
}

/** Stands in for the backend scheduler: expire pickups and offers, then re-offer copies. Idempotent. */
export function runJobs(): void {
  const now = Date.now();
  for (const r of db.requests) {
    if (r.status === "APPROVED" && r.pickupDeadline && new Date(r.pickupDeadline).getTime() < now) {
      r.status = "EXPIRED";
      r.decisionReason = "Pickup deadline passed";
      notify(studentUserId(r.studentId), "BORROW_REQUEST_EXPIRED", "Pickup window expired", `Your pickup window for ${r.bookTitle} expired. The copy has been released.`, ["BORROWING_REQUEST", r.id]);
      const copy = r.assignedCopyId ? copyById(r.assignedCopyId) : undefined;
      if (copy && copy.status === "RESERVED") releaseCopy(copy);
    }
  }
  for (const r of db.reservations) {
    if (r.status === "OFFERED" && r.pickupDeadline && new Date(r.pickupDeadline).getTime() < now) {
      r.status = "EXPIRED";
      notify(studentUserId(r.studentId), "RESERVATION_EXPIRED", "Reservation expired", `You did not collect ${r.bookTitle} in time. The copy was passed on.`, ["RESERVATION", r.id]);
      const copy = r.offeredCopyId ? copyById(r.offeredCopyId) : undefined;
      if (copy && copy.status === "RESERVED") releaseCopy(copy);
    }
  }
  fillQueues();
}

// ---------- loans, handover, fines ----------
export function createLoan(studentId: UUID, copy: BookCopy, bookTitle: string, days: number): MockLoan {
  const now = nowIso();
  const loan: MockLoan = {
    id: newId(),
    studentId,
    bookId: copy.bookId,
    bookTitle,
    copyId: copy.id,
    copyBarcode: copy.barcode,
    status: "ACTIVE",
    borrowedAt: now,
    dueAt: addDaysIso(now, days), // TC-14: now + N x 24h vs end of Manila day is TO CONFIRM
    returnedAt: null,
    renewedCount: 0,
  };
  db.loans.unshift(loan);
  copy.status = "ON_LOAN";
  return loan;
}

export function recordAttempt(requestId: UUID, action: HandoverAction, staff: MockAccount, reasonCode: string | null, notes: string | null): void {
  db.attempts.push({ id: newId(), requestId, action, reasonCode, notes, staffName: staff.displayName, createdAt: nowIso() });
}

/** The amount comes from the fixed table, never from the client. */
export function recordFine(actor: MockAccount, loan: MockLoan, fineType: FineType, notes: string): MockFine {
  const fine: MockFine = {
    id: newId(),
    studentId: loan.studentId,
    loanId: loan.id,
    bookTitle: loan.bookTitle,
    fineType,
    amount: FINE_AMOUNTS[fineType],
    status: "UNPAID",
    recordedAt: nowIso(),
    notes,
  };
  db.fines.unshift(fine);
  notify(studentUserId(loan.studentId), "FINE_RECORDED", "Fine recorded", `A fine of ${formatPeso(fine.amount)} was recorded for ${statusLabel(fineType)}. Pay it in person at the library.`, ["FINE", fine.id]);
  audit(actor, "FINE_RECORDED", "FINE", fine.id, `Recorded a ${formatPeso(fine.amount)} ${statusLabel(fineType).toLowerCase()} fine for ${studentName(loan.studentId)} (${loan.bookTitle}).`);
  return fine;
}

// ---------- row mappers (strip mock-only fields) ----------
export function toLoan(l: MockLoan): Loan {
  const { studentId: _studentId, ...loan } = l;
  return loan;
}
export const toStaffLoan = (l: MockLoan): StaffLoan => ({ ...toLoan(l), student: studentRef(l.studentId), overdueDays: l.status === "ACTIVE" ? overdueDays(l.dueAt) : 0 });

export function toRequest(r: MockBorrowingRequest): BorrowingRequest {
  const { studentId: _studentId, ...request } = r;
  return request;
}
export function toStaffRequest(r: MockBorrowingRequest): StaffBorrowingRequest {
  const copy = r.assignedCopyId ? copyById(r.assignedCopyId) : undefined;
  return { ...toRequest(r), student: studentRef(r.studentId), copy: copy ? copyRef(copy) : null };
}

export function toBookToRelease(r: MockBorrowingRequest): BookToRelease {
  const copy = r.assignedCopyId ? copyById(r.assignedCopyId) : undefined;
  if (!copy || !r.approvedAt || !r.pickupDeadline) fail("INVALID_STATE", "This request has no assigned copy.");
  return {
    requestId: r.id,
    student: studentRef(r.studentId),
    book: { id: r.bookId, title: r.bookTitle },
    copy: copyRef(copy),
    requestedDurationDays: r.requestedDurationDays,
    approvedAt: r.approvedAt,
    pickupDeadline: r.pickupDeadline,
    status: r.status as "APPROVED" | "ON_HOLD",
  };
}

export function toReservation(r: MockReservation): Reservation {
  const { studentId: _studentId, ...reservation } = r;
  return { ...reservation, queuePosition: r.status === "WAITING" ? queuePosition(r) : undefined };
}

export function toNotification(n: MockNotification): NotificationItem {
  const { userId: _userId, ...item } = n;
  return item;
}

export { commit };