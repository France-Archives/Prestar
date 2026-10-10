import type { CreateRenewalRequest, RenewalRequest, RenewalView, StaffRenewalView, UUID } from "@/types";
import type { MockRenewal } from "@/data";
import { fail } from "@/utils/errors";
import { addDaysIso, formatDate } from "@/utils/formatDate";
import { validateDuration } from "@/utils/validators";
import { assertEligible, begin, setting, studentRef, studentUserId } from "./mockEngine";
import { audit, commit, db, matches, newId, notify, nowIso, out, requireAccount, requireCapability, requireStudent } from "./mockStore";
import { can } from "@/utils/permissions";
import { sessionUserOf } from "./mockStore";

// TEMPORARY MOCK IMPLEMENTATION: Replace with the real renewal API (B6, P14).
// Renewals are decided AUTOMATICALLY by the backend. New due date = approval date + duration; old and new are both kept.
// Final renewal limit (TC-07) and the time-of-day rule (TC-14) are TO CONFIRM.

const strip = (r: MockRenewal): RenewalView => {
  const { studentId: _studentId, ...view } = r;
  return view;
};

/** B6 POST /loans/:loanId/renewals */
export async function createRenewal(loanId: UUID, req: CreateRenewalRequest): Promise<RenewalRequest> {
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

/** The student's renewal history (all loans). Derived from P14 per loan. */
export async function listMyRenewals(): Promise<RenewalView[]> {
  await begin();
  const { student } = requireStudent();
  return out(db.renewals.filter((r) => r.studentId === student.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).map(strip));
}

/** P14 GET /loans/:loanId/renewals (owner student, or staff) */
export async function listLoanRenewals(loanId: UUID): Promise<RenewalView[]> {
  await begin();
  const account = requireAccount();
  const loan = db.loans.find((l) => l.id === loanId);
  const staff = can(sessionUserOf(account), "STAFF_AREA");
  if (!loan || (!staff && loan.studentId !== account.student?.id)) fail("NOT_FOUND", "We could not find that loan.");
  return out(db.renewals.filter((r) => r.loanId === loanId).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).map(strip));
}

/** Staff overview of all renewals (renewal management page). Staff only observe; decisions are automatic. */
export async function listStaffRenewals(params: { search?: string } = {}): Promise<StaffRenewalView[]> {
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