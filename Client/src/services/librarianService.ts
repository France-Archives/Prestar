import type {
  AccountStatus,
  BookToRelease,
  ClaimRequest,
  HandoverAttempt,
  HoldHandoverRequest,
  Loan,
  LoanStatus,
  MarkLostRequest,
  PenaltyCheck,
  RejectHandoverRequest,
  ReturnRequest,
  ReturnResult,
  StaffBorrowingRequest,
  StaffFine,
  StaffLoan,
  BorrowingRequestStatus,
  UUID,
} from "@/types";
import { COPY_CONDITIONS } from "@/types";
import { fail } from "@/utils/errors";
import { isPast } from "@/utils/formatDate";
import {
  begin,
  checkEligibility,
  copyById,
  createLoan,
  recordAttempt,
  recordFine,
  releaseCopy,
  studentName,
  studentRef,
  studentUserId,
  toBookToRelease,
  toLoan,
  toStaffFine,
  toStaffLoan,
  toStaffRequest,
} from "./mockEngine";
import { audit, commit, db, matches, notify, nowIso, out, requireCapability } from "./mockStore";

// TEMPORARY MOCK IMPLEMENTATION: Replace with the real staff API (H1 to H7, F3, P4, P8, P9, P12, P16).
// Every function here is available to Librarian AND Admin (Admin = Librarian + Admin-only). The real backend enforces
// this in middleware and re-checks eligibility inside the handover transaction. There is no unlogged override:
// mandatory restrictions cannot be bypassed by a staff click.
// COR review lives in verificationService, fines and payments in finesService, reservations in reservationsService.

const need = (value: string, message: string): string => {
  if (!value.trim()) fail("VALIDATION_ERROR", message, 422);
  return value.trim();
};

function findRequest(id: UUID) {
  const request = db.requests.find((r) => r.id === id);
  if (!request) fail("NOT_FOUND", "We could not find that borrowing request.");
  return request;
}

// ---------- Books to Release and handover ----------

/** H1 GET /staff/books-to-release: APPROVED and ON_HOLD requests, earliest pickup deadline first. */
export async function listBooksToRelease(params: { search?: string } = {}): Promise<BookToRelease[]> {
  await begin();
  requireCapability("STAFF_AREA");
  return out(
    db.requests
      .filter((r) => r.status === "APPROVED" || r.status === "ON_HOLD")
      .map(toBookToRelease)
      .filter((b) => matches(params.search, b.student.firstName, b.student.lastName, b.student.studentNumber, b.book.title, b.copy.barcode))
      .sort((a, b) => a.pickupDeadline.localeCompare(b.pickupDeadline)),
  );
}

export interface HandoverDetails {
  /** null once the request is no longer awaiting release (CLAIMED, EXPIRED, ...). */
  item: BookToRelease | null;
  request: StaffBorrowingRequest;
  attempts: HandoverAttempt[];
}

/** Composed from H1 + P8 + handover_attempts for the handover details page. */
export async function getHandoverDetails(requestId: UUID): Promise<HandoverDetails> {
  await begin();
  requireCapability("STAFF_AREA");
  const request = findRequest(requestId);
  const awaiting = request.status === "APPROVED" || request.status === "ON_HOLD";
  return out({
    item: awaiting ? toBookToRelease(request) : null,
    request: toStaffRequest(request),
    attempts: db.attempts.filter((a) => a.requestId === requestId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
}

/** H2 POST /staff/borrowing-requests/:id/check-eligibility ("Check Penalties"). Live check; records a CHECKED attempt. */
export async function checkHandoverEligibility(requestId: UUID): Promise<PenaltyCheck> {
  await begin();
  const staff = requireCapability("STAFF_AREA");
  const request = findRequest(requestId);
  if (request.status !== "APPROVED" && request.status !== "ON_HOLD") fail("INVALID_STATE", "This request is no longer awaiting release.", 409);
  const check = checkEligibility(request.studentId);
  recordAttempt(request.id, "CHECKED", staff, null, null);
  commit();
  return out(check);
}

/** H3 POST /staff/borrowing-requests/:id/hold. A resolvable issue; the copy stays assigned. Reason required. */
export async function holdHandover(requestId: UUID, req: HoldHandoverRequest): Promise<StaffBorrowingRequest> {
  await begin();
  const staff = requireCapability("STAFF_AREA");
  const reasonCode = need(req.reasonCode, "Choose a reason.");
  const notes = need(req.notes, "Add notes explaining the hold.");
  const request = findRequest(requestId);
  if (request.status !== "APPROVED") fail("INVALID_STATE", "Only an approved request can be placed on hold.", 409);
  request.status = "ON_HOLD"; // max hold time and whether the pickup deadline keeps running are TO CONFIRM (TC-09)
  request.decisionReason = notes;
  recordAttempt(request.id, "PLACED_ON_HOLD", staff, reasonCode, notes);
  notify(studentUserId(request.studentId), "BORROW_REQUEST_ON_HOLD", "Pickup on hold", `Your pickup is on hold: ${notes}. Please resolve this with the library before ${request.pickupDeadline ? new Date(request.pickupDeadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "the deadline"}.`, ["BORROWING_REQUEST", request.id]);
  audit(staff, "HANDOVER_HELD", "BORROWING_REQUEST", request.id, `Placed the pickup of ${request.bookTitle} for ${studentName(request.studentId)} on hold: ${notes}`);
  commit();
  return out(toStaffRequest(request));
}

/** H4 POST /staff/borrowing-requests/:id/reject-handover. The release cannot proceed. Reason required. */
export async function rejectHandover(requestId: UUID, req: RejectHandoverRequest): Promise<StaffBorrowingRequest> {
  await begin();
  const staff = requireCapability("STAFF_AREA");
  const reasonCode = need(req.reasonCode, "Choose a reason.");
  const notes = need(req.notes, "Add notes explaining the rejection.");
  const request = findRequest(requestId);
  if (request.status !== "APPROVED" && request.status !== "ON_HOLD") fail("INVALID_STATE", "This request is no longer awaiting release.", 409);
  request.status = "RELEASE_REJECTED";
  request.decisionReason = notes;
  recordAttempt(request.id, "REJECTED", staff, reasonCode, notes);
  // TC-10 baseline: the copy is released (offered to the queue or made AVAILABLE) and the student must request again. TO CONFIRM.
  const copy = request.assignedCopyId ? copyById(request.assignedCopyId) : undefined;
  if (copy && copy.status === "RESERVED") releaseCopy(copy);
  notify(studentUserId(request.studentId), "HANDOVER_REJECTED", "Handover not possible", `The library could not release ${request.bookTitle}: ${notes}. Contact the library for next steps.`, ["BORROWING_REQUEST", request.id]);
  audit(staff, "HANDOVER_REJECTED", "BORROWING_REQUEST", request.id, `Rejected the handover of ${request.bookTitle} to ${studentName(request.studentId)}: ${notes}`);
  commit();
  return out(toStaffRequest(request));
}

/** H5 POST /staff/borrowing-requests/:id/claim ("Confirm Handover"). The ONLY place a loan is created from a request. */
export async function claimHandover(requestId: UUID, req: ClaimRequest): Promise<Loan> {
  await begin();
  const staff = requireCapability("STAFF_AREA");
  const request = findRequest(requestId);
  if (request.status !== "APPROVED" && request.status !== "ON_HOLD") fail("INVALID_STATE", "This request is no longer awaiting release.", 409);
  need(req.copyBarcode, "Scan or enter the copy barcode.");
  if (isPast(request.pickupDeadline)) fail("INVALID_STATE", "The pickup deadline has passed.", 409);
  const copy = request.assignedCopyId ? copyById(request.assignedCopyId) : undefined;
  if (!copy) fail("INVALID_STATE", "The assigned copy could not be found.", 409);
  if (copy.barcode !== req.copyBarcode.trim()) {
    fail("VALIDATION_ERROR", "The barcode does not match the assigned copy. If the copy cannot be released, use Reject Handover.", 422);
  }

  // Eligibility is re-checked at the moment of handover (inside the transaction in the real backend).
  const check = checkEligibility(request.studentId);
  if (!check.eligible) {
    audit(staff, "HANDOVER_CLAIM_FAILED", "BORROWING_REQUEST", request.id, `Handover of ${request.bookTitle} to ${studentName(request.studentId)} failed: ${check.reasons[0].message}`);
    commit();
    fail("ELIGIBILITY_FAILED", check.reasons[0].message, 403, { reasons: check.reasons });
  }

  const loan = createLoan(request.studentId, copy, request.bookTitle, request.requestedDurationDays);
  request.status = "CLAIMED";
  request.claimedAt = loan.borrowedAt;
  recordAttempt(request.id, "CLAIMED", staff, null, null);
  notify(studentUserId(request.studentId), "LOAN_ISSUED", "Book issued", `You borrowed ${request.bookTitle}. It is due on ${new Date(loan.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`, ["LOAN", loan.id]);
  audit(staff, "HANDOVER_CLAIMED", "BORROWING_REQUEST", request.id, `Confirmed handover of ${request.bookTitle} to ${studentName(request.studentId)}.`);
  commit();
  return out(toLoan(loan));
}

// ---------- all requests, cancel, expire ----------

/** P8 GET /staff/borrowing-requests (proposed): all requests including non-APPROVED. */
export async function listStaffBorrowingRequests(params: { status?: BorrowingRequestStatus; search?: string } = {}): Promise<StaffBorrowingRequest[]> {
  await begin();
  requireCapability("STAFF_AREA");
  return out(
    db.requests
      .filter((r) => !params.status || r.status === params.status)
      .map(toStaffRequest)
      .filter((r) => matches(params.search, r.bookTitle, r.student.firstName, r.student.lastName, r.student.studentNumber, r.copy?.barcode))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
  );
}

/** P9 POST /staff/borrowing-requests/:id/cancel (proposed). Distinct from Hold, Reject Handover and Expire. */
export async function cancelBorrowingRequestAsStaff(requestId: UUID, reason: string): Promise<StaffBorrowingRequest> {
  await begin();
  const staff = requireCapability("STAFF_AREA");
  const why = need(reason, "A reason is required to cancel a request.");
  const request = findRequest(requestId);
  if (request.status !== "APPROVED" && request.status !== "ON_HOLD" && request.status !== "PENDING") fail("INVALID_STATE", "This request can no longer be cancelled.", 409);
  request.status = "CANCELLED";
  request.decisionReason = why;
  const copy = request.assignedCopyId ? copyById(request.assignedCopyId) : undefined;
  if (copy && copy.status === "RESERVED") releaseCopy(copy);
  audit(staff, "REQUEST_CANCELLED", "BORROWING_REQUEST", request.id, `Cancelled the request for ${request.bookTitle} by ${studentName(request.studentId)}: ${why}`);
  commit();
  return out(toStaffRequest(request));
}

/** P16 POST /staff/borrowing-requests/:id/expire (proposed). The system job is primary; manual behaviour is TO CONFIRM. */
export async function expireBorrowingRequest(requestId: UUID): Promise<StaffBorrowingRequest> {
  await begin();
  const staff = requireCapability("STAFF_AREA");
  const request = findRequest(requestId);
  if (request.status !== "APPROVED" && request.status !== "ON_HOLD") fail("INVALID_STATE", "Only an approved or held request can be expired.", 409);
  request.status = "EXPIRED";
  request.decisionReason = "Expired by staff";
  const copy = request.assignedCopyId ? copyById(request.assignedCopyId) : undefined;
  if (copy && copy.status === "RESERVED") releaseCopy(copy);
  notify(studentUserId(request.studentId), "BORROW_REQUEST_EXPIRED", "Pickup window expired", `Your pickup window for ${request.bookTitle} expired. The copy has been released.`, ["BORROWING_REQUEST", request.id]);
  audit(staff, "REQUEST_EXPIRED", "BORROWING_REQUEST", request.id, `Expired the request for ${request.bookTitle} by ${studentName(request.studentId)}.`);
  commit();
  return out(toStaffRequest(request));
}

// ---------- loans, returns, lost ----------

/** P4 GET /staff/loans (proposed) */
export async function listStaffLoans(params: { status?: LoanStatus; overdueOnly?: boolean; search?: string } = {}): Promise<StaffLoan[]> {
  await begin();
  requireCapability("STAFF_AREA");
  return out(
    db.loans
      .map(toStaffLoan)
      .filter((l) => !params.status || l.status === params.status)
      .filter((l) => !params.overdueOnly || l.overdueDays > 0)
      .filter((l) => matches(params.search, l.bookTitle, l.copyBarcode, l.student.firstName, l.student.lastName, l.student.studentNumber))
      .sort((a, b) => (a.status === "ACTIVE" ? 0 : 1) - (b.status === "ACTIVE" ? 0 : 1) || a.dueAt.localeCompare(b.dueAt)),
  );
}

/** H6 POST /staff/loans/:loanId/return. Never blocked by overdue, fines or suspension. */
export async function returnLoan(loanId: UUID, req: ReturnRequest): Promise<ReturnResult> {
  await begin();
  const staff = requireCapability("STAFF_AREA");
  const loan = db.loans.find((l) => l.id === loanId);
  if (!loan) fail("NOT_FOUND", "We could not find that loan.");
  if (loan.status !== "ACTIVE") fail("INVALID_STATE", "This loan is already closed.", 409);
  if (!COPY_CONDITIONS.includes(req.condition)) fail("VALIDATION_ERROR", "Choose the condition of the returned copy.", 422);
  const copy = copyById(loan.copyId);
  if (!copy) fail("INVALID_STATE", "The copy of this loan could not be found.", 409);

  loan.status = "RETURNED";
  loan.returnedAt = nowIso();
  copy.condition = req.condition;
  if (req.notes?.trim()) copy.notes = req.notes.trim();
  // Usable condition: back to the shelf or offered to the first eligible reservation. Damaged: maintenance. Unusable: withdrawn.
  if (req.condition === "DAMAGED") copy.status = "MAINTENANCE";
  else if (req.condition === "UNUSABLE") copy.status = "WITHDRAWN";
  else releaseCopy(copy);

  const offered = db.reservations.find((r) => r.status === "OFFERED" && r.offeredCopyId === copy.id);
  notify(studentUserId(loan.studentId), "LOAN_RETURNED", "Book returned", `Your return of ${loan.bookTitle} was recorded.`, ["LOAN", loan.id]);
  audit(staff, "LOAN_RETURNED", "LOAN", loan.id, `Received ${loan.bookTitle} from ${studentName(loan.studentId)} in ${req.condition} condition.`);
  commit();
  return out({ loan: toLoan(loan), copyStatus: copy.status, offeredToReservationId: offered?.id ?? null });
}

/**
 * H7 POST /staff/loans/:loanId/mark-lost. Only after confirming with the student; overdue never becomes lost by itself.
 * The server creates the ₱500 lost-book fine (body shape is TO CONFIRM).
 */
export async function markLoanLost(loanId: UUID, req: MarkLostRequest = {}): Promise<StaffFine> {
  await begin();
  const staff = requireCapability("STAFF_AREA");
  const loan = db.loans.find((l) => l.id === loanId);
  if (!loan) fail("NOT_FOUND", "We could not find that loan.");
  if (loan.status !== "ACTIVE") fail("INVALID_STATE", "Only an active loan can be marked lost.", 409);
  const copy = copyById(loan.copyId);
  if (!copy) fail("INVALID_STATE", "The copy of this loan could not be found.", 409);
  loan.status = "LOST";
  copy.status = "LOST";
  copy.condition = "UNUSABLE";
  copy.notes = req.notes?.trim() || "Marked lost after confirming with the borrower.";
  const fine = recordFine(staff, loan, "LOST_BOOK", req.notes?.trim() || "Marked lost after confirming with the student.");
  audit(staff, "LOAN_MARKED_LOST", "LOAN", loan.id, `Marked ${loan.bookTitle} lost for ${studentName(loan.studentId)}.`);
  commit();
  return out(toStaffFine(fine));
}

// ---------- students ----------

/** F3 GET /staff/students/:studentId/penalty-check */
export async function getPenaltyCheck(studentId: UUID): Promise<PenaltyCheck> {
  await begin();
  requireCapability("STAFF_AREA");
  studentRef(studentId); // 404 when unknown
  return out(checkEligibility(studentId));
}

export interface StaffStudentRow {
  id: UUID;
  studentNumber: string;
  firstName: string;
  lastName: string;
  program: string | null;
  email: string;
  accountStatus: AccountStatus;
}

/** P12 GET /staff/students (proposed): student lookup for staff. */
export async function listStudents(params: { search?: string } = {}): Promise<StaffStudentRow[]> {
  await begin();
  requireCapability("STAFF_AREA");
  return out(
    db.accounts
      .filter((a) => a.student)
      .map((a): StaffStudentRow => {
        const s = a.student!;
        return { id: s.id, studentNumber: s.studentNumber, firstName: s.firstName, lastName: s.lastName, program: s.program, email: a.user.email, accountStatus: a.user.accountStatus };
      })
      .filter((s) => matches(params.search, s.firstName, s.lastName, s.studentNumber, s.email))
      .sort((a, b) => a.lastName.localeCompare(b.lastName)),
  );
}