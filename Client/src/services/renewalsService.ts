import type { CreateRenewalRequest, RenewalRequest, RenewalView, StaffRenewalView, UUID } from "@/types";
import type { MockRenewal } from "@/data";
import { fail, unsupportedOperation } from "@/utils/errors";
import { USE_MOCKS } from "@/utils/constants";
import { addDaysIso, formatDate } from "@/utils/formatDate";
import { validateDuration } from "@/utils/validators";
import { assertEligible, begin, setting, studentRef, studentUserId } from "./mockEngine";
import { audit, commit, db, matches, newId, notify, nowIso, out, requireAccount, requireCapability, requireStudent } from "./mockStore";
import { can } from "@/utils/permissions";
import { sessionUserOf } from "./mockStore";

// Mock-only: the current Server does not expose renewal endpoints.

const strip = (r: MockRenewal): RenewalView => {
  const { studentId: _studentId, ...view } = r;
  return view;
};

/** Create a mock renewal decision and update the mock loan when approved. */
export async function createRenewal(loanId: UUID, req: CreateRenewalRequest): Promise<RenewalRequest> {
  if (!USE_MOCKS) unsupportedOperation("Renewals");
  await begin();
  const { account, student } = requireStudent();
  const loan = db.loans.find((l) => l.id === loanId && l.studentId === student.id);
  if (!loan) fail("NOT_FOUND", "We could not find that loan.");
  if (loan.status !== "ACTIVE") fail("INVALID_STATE", "Only active loans can be renewed.", 409);
  const durationError = validateDuration(req.requestedDurationDays);
  if (durationError) fail("INVALID_DURATION", durationError, 422);
  assertEligible(student.id); // account, email, COR, overdue and fines; the commitment limits do not apply to a renewal
  if (loan.renewedCount >= setting("RENEWAL_LIMIT")) fail("RENEWAL_LIMIT_REACHED", undefined, 403);

  const now = nowIso();
  const base: MockRenewal = {
    id: newId(),
    studentId: student.id,
    loanId: loan.id,
    bookTitle: loan.bookTitle,
    requestedDurationDays: req.requestedDurationDays,
    status: "REJECTED",
    requestedAt: now,
    approvedAt: null,
    oldDueAt: null,
    newDueAt: null,
    decisionReason: null,
  };

  // Auto-reject when another student is waiting for the title (WAITING or OFFERED).
  const queued = db.reservations.some((r) => r.bookId === loan.bookId && (r.status === "WAITING" || r.status === "OFFERED"));
  if (queued) {
    base.decisionReason = "Another student is waiting for this title.";
    db.renewals.unshift(base);
    notify(account.user.id, "RENEWAL_REJECTED", "Renewal not approved", `Your renewal for ${loan.bookTitle} was not approved: ${base.decisionReason}`, ["LOAN", loan.id]);
    commit();
    return out(strip(base));
  }

  base.status = "APPROVED";
  base.approvedAt = now;
  base.oldDueAt = loan.dueAt;
  base.newDueAt = addDaysIso(now, req.requestedDurationDays); // counted from the approval date, not the old due date
  loan.dueAt = base.newDueAt;
  loan.renewedCount += 1;
  db.renewals.unshift(base);
  notify(account.user.id, "RENEWAL_APPROVED", "Renewal approved", `Your renewal for ${loan.bookTitle} was approved. New due date: ${formatDate(base.newDueAt)}.`, ["LOAN", loan.id]);
  commit();
  return out(strip(base));
}

/** List the current student's mock renewal history. */
export async function listMyRenewals(): Promise<RenewalView[]> {
  if (!USE_MOCKS) unsupportedOperation("Renewals");
  await begin();
  const { student } = requireStudent();
  return out(db.renewals.filter((r) => r.studentId === student.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).map(strip));
}

/** List mock renewals for a loan owned by the current student, or for staff. */
export async function listLoanRenewals(loanId: UUID): Promise<RenewalView[]> {
  if (!USE_MOCKS) unsupportedOperation("Renewals");
  await begin();
  const account = requireAccount();
  const loan = db.loans.find((l) => l.id === loanId);
  const staff = can(sessionUserOf(account), "STAFF_AREA");
  if (!loan || (!staff && loan.studentId !== account.student?.id)) fail("NOT_FOUND", "We could not find that loan.");
  return out(db.renewals.filter((r) => r.loanId === loanId).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).map(strip));
}

/** List mock renewal history for staff. */
export async function listStaffRenewals(params: { search?: string } = {}): Promise<StaffRenewalView[]> {
  if (!USE_MOCKS) unsupportedOperation("Renewals");
  await begin();
  const staff = requireCapability("STAFF_AREA");
  void staff;
  void audit;
  return out(
    db.renewals
      .map((r): StaffRenewalView => ({ ...strip(r), student: studentRef(r.studentId) }))
      .filter((r) => matches(params.search, r.bookTitle, r.student.firstName, r.student.lastName, r.student.studentNumber))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
  );
}

export { studentUserId as _studentUserId };