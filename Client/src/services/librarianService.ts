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
import { apiClient, apiGet } from "@/services/apiClient";
import { USE_MOCKS } from "@/utils/constants";
import { ApiError, fail, unsupportedOperation } from "@/utils/errors";
import { isPast, overdueDays } from "@/utils/formatDate";
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

type BackendRow = Record<string, unknown>;

function backendRow(value: unknown): BackendRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("UNKNOWN", "The Server returned an invalid staff-operation response.");
  }
  return value as BackendRow;
}

function positiveIntegerId(value: UUID, label: string): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    fail("VALIDATION_ERROR", `${label} must be a positive integer.`, 400);
  }
  return Number(value);
}

function requestStatus(value: unknown): BorrowingRequestStatus {
  const normalized = typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "_") : "";
  const values: Record<string, BorrowingRequestStatus> = {
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    ON_HOLD: "ON_HOLD",
    REJECTED: "RELEASE_REJECTED",
    FULFILLED: "CLAIMED",
    CLAIMED: "CLAIMED",
    CANCELLED: "CANCELLED",
    EXPIRED: "EXPIRED",
  };
  const status = values[normalized];
  if (!status) throw new ApiError("UNKNOWN", `The Server returned an unsupported request status: ${String(value)}.`);
  return status;
}

async function fetchPaginatedRows(url: string, params: Record<string, unknown>, property: string): Promise<BackendRow[]> {
  const limit = 50;
  const first = backendRow((await apiClient.get<unknown>(url, { params: { ...params, page: 1, limit } })).data);
  const rows = Array.isArray(first[property]) ? [...first[property] as unknown[]] : [];
  const pagination = first.pagination && typeof first.pagination === "object"
    ? first.pagination as BackendRow
    : {};
  const totalPages = Math.max(1, Number(pagination.totalPages ?? 1));
  for (let page = 2; page <= totalPages; page += 1) {
    const response = backendRow((await apiClient.get<unknown>(url, { params: { ...params, page, limit } })).data);
    if (Array.isArray(response[property])) rows.push(...response[property] as unknown[]);
  }
  return rows.map(backendRow);
}

function mapStaffLoan(value: unknown): StaffLoan {
  const row = backendRow(value);
  const student = row.student && typeof row.student === "object" ? row.student as BackendRow : {};
  const book = row.book && typeof row.book === "object" ? row.book as BackendRow : {};
  const copy = row.copy && typeof row.copy === "object" ? row.copy as BackendRow : {};
  const name = String(student.name ?? "").trim().split(/\s+/);
  const statusValue = typeof row.status === "string" ? row.status.trim().toUpperCase() : "";
  const status: LoanStatus = statusValue === "BORROWED"
    ? "ACTIVE"
    : statusValue === "RETURNED" || statusValue === "LOST"
      ? statusValue
      : (() => { throw new ApiError("UNKNOWN", `The Server returned an unsupported loan status: ${String(row.status)}.`); })();
  const dueAt = String(row.dueAt ?? row.dueDate ?? row.due_date ?? "");
  const borrowedAt = String(row.borrowedAt ?? row.borrowDate ?? row.borrow_date ?? "");
  return {
    id: String(row.id ?? row.borrowId ?? row.borrow_id),
    bookId: String(row.bookId ?? row.book_id ?? book.id ?? book.book_id ?? ""),
    bookTitle: String(row.bookTitle ?? book.title ?? "Unknown title"),
    copyId: String(row.copyId ?? row.copy_id ?? copy.id ?? copy.copy_id ?? ""),
    copyBarcode: String(row.copyBarcode ?? copy.accessionNo ?? copy.accession_no ?? ""),
    status,
    borrowedAt,
    dueAt,
    returnedAt: row.returnedAt == null && row.returned_at == null ? null : String(row.returnedAt ?? row.returned_at),
    renewedCount: Number(row.renewedCount ?? row.renewed_count ?? 0),
    student: {
      id: String(student.id ?? student.userId ?? student.user_id ?? ""),
      studentNumber: String(student.studentNumber ?? student.student_number ?? ""),
      firstName: String(student.firstName ?? name[0] ?? ""),
      lastName: String(student.lastName ?? name.slice(1).join(" ")),
    },
    overdueDays: status === "ACTIVE" && dueAt ? overdueDays(dueAt) : 0,
  };
}

function mapStaffRequest(value: unknown, loan?: BackendRow): StaffBorrowingRequest {
  const row = backendRow(value);
  const student = row.student && typeof row.student === "object" ? row.student as BackendRow : {};
  const book = row.book && typeof row.book === "object" ? row.book as BackendRow : {};
  const copy = loan?.copy && typeof loan.copy === "object" ? loan.copy as BackendRow : {};
  const name = String(student.name ?? "").trim().split(/\s+/);
  const status = requestStatus(row.status);
  return {
    id: String(row.id ?? row.requestId ?? row.request_id),
    bookId: String(row.bookId ?? row.book_id ?? book.id ?? ""),
    bookTitle: String(row.bookTitle ?? book.title ?? "Unknown title"),
    assignedCopyId: loan ? String(loan.copyId ?? loan.copy_id ?? copy.id ?? copy.copy_id ?? "") : null,
    requestedDurationDays: Number(row.requestedDurationDays ?? row.requested_days ?? 0),
    status,
    requestedAt: String(row.requestedAt ?? row.request_date ?? ""),
    approvedAt: row.approvedAt == null && row.reviewedAt == null && row.reviewed_at == null
      ? null
      : String(row.approvedAt ?? row.reviewedAt ?? row.reviewed_at),
    pickupDeadline: row.pickupDeadline == null && row.pickup_deadline == null
      ? null
      : String(row.pickupDeadline ?? row.pickup_deadline),
    claimedAt: null,
    decisionReason: typeof (row.decisionReason ?? row.remarks) === "string" ? String(row.decisionReason ?? row.remarks) : null,
    student: {
      id: String(student.id ?? student.userId ?? student.user_id ?? ""),
      studentNumber: String(student.studentNumber ?? student.student_number ?? ""),
      firstName: String(student.firstName ?? name[0] ?? ""),
      lastName: String(student.lastName ?? name.slice(1).join(" ")),
    },
    copy: loan
      ? {
          id: String(loan.copyId ?? loan.copy_id ?? copy.id ?? copy.copy_id ?? ""),
          barcode: String(copy.accessionNo ?? copy.accession_no ?? copy.barcode ?? ""),
        }
      : null,
  };
}

async function reservedStaffLoans(): Promise<BackendRow[]> {
  return fetchPaginatedRows("/borrowed-books", { status: "Reserved" }, "loans");
}

function toReleaseItem(request: StaffBorrowingRequest): BookToRelease {
  const rawCopy = request.copy;
  if (!rawCopy) throw new ApiError("UNKNOWN", "The Server did not return the reserved copy for an approved request.");
  return {
    requestId: request.id,
    reservationId: null,
    student: request.student,
    book: { id: request.bookId, title: request.bookTitle },
    copy: {
      ...rawCopy,
      shelfLocation: null,
      section: null,
      shelfCode: null,
      levelOrRow: null,
      locationNotes: null,
    },
    requestedDurationDays: request.requestedDurationDays || null,
    approvedAt: request.approvedAt,
    pickupDeadline: request.pickupDeadline,
    status: "APPROVED",
  };
}

function mapPickupCheck(value: unknown, studentId: UUID): PenaltyCheck {
  const row = backendRow(value);
  const verification = row.verification && typeof row.verification === "object"
    ? row.verification as BackendRow
    : {};
  const penalties = row.penalties && typeof row.penalties === "object"
    ? row.penalties as BackendRow
    : {};
  const reasons = Array.isArray(row.reasons) ? row.reasons : [];
  const fines = Array.isArray(penalties.list) ? penalties.list : [];
  return {
    studentId,
    checkedAt: null,
    eligible: row.can_release === true,
    accountStatus: null,
    emailVerified: null,
    corStatus: verification.status
      ? String(verification.status).trim().toUpperCase().replace(/[\s-]+/g, "_") as PenaltyCheck["corStatus"]
      : null,
    activeCommitmentCount: null,
    reasons: reasons.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const reason = value as BackendRow;
      return [{ code: String(reason.code ?? "RESTRICTION"), message: String(reason.message ?? "") }];
    }),
    overdueLoans: [],
    unpaidFines: fines.map((value) => {
      const fine = backendRow(value);
      return {
        fineId: String(fine.penalty_id ?? fine.id ?? ""),
        fineType: String(fine.penalty_type ?? fine.fineType ?? "Unknown"),
        amount: Number(fine.amount ?? 0),
        paidAmount: Number(fine.amount_paid ?? fine.paidAmount ?? 0),
        balance: Number(fine.balance ?? 0),
      };
    }),
  };
}

// The live API supports request queue/review, reserved-book pickup checks, handover, COR review and reservation listing.
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
  if (!USE_MOCKS) {
    return apiGet<BookToRelease[]>("/staff/books-to-release", params);
  }
  await begin();
  requireCapability("STAFF_AREA");
  return out(
    db.requests
      .filter((r) => r.status === "APPROVED" || r.status === "ON_HOLD")
      .map(toBookToRelease)
      .filter((b) => matches(params.search, b.student.firstName, b.student.lastName, b.student.studentNumber, b.book.title, b.copy.barcode))
      .sort((a, b) => (a.pickupDeadline ?? "").localeCompare(b.pickupDeadline ?? "")),
  );
}

export interface HandoverDetails {
  /** null once the request is no longer awaiting release (CLAIMED, EXPIRED, ...). */
  item: BookToRelease | null;
  request: StaffBorrowingRequest;
  attempts: HandoverAttempt[];
  attemptsAvailable: boolean;
}

/** Composed from H1 + P8 + handover_attempts for the handover details page. */
export async function getHandoverDetails(requestId: UUID): Promise<HandoverDetails> {
  if (!USE_MOCKS) {
    positiveIntegerId(requestId, "Request id");
    const list = await listBooksToRelease();
    const item = list.find((b) => b.requestId === requestId) ?? null;
    if (item) {
      return {
        item,
        request: {
          id: item.requestId,
          bookId: item.book.id,
          bookTitle: item.book.title,
          assignedCopyId: item.copy.id,
          requestedDurationDays: item.requestedDurationDays ?? 0,
          status: item.status === "OFFERED" ? "APPROVED" : item.status,
          requestedAt: item.approvedAt ?? "",
          approvedAt: item.approvedAt,
          pickupDeadline: item.pickupDeadline,
          claimedAt: null,
          decisionReason: null,
          student: item.student,
          copy: item.copy,
        },
        attempts: [],
        attemptsAvailable: false,
      };
    }
    const request = (await listStaffBorrowingRequests()).find((r) => r.id === requestId);
    if (!request) fail("NOT_FOUND", "We could not find an approved request awaiting handover.");
    const awaiting = request.status === "APPROVED";
    return {
      item: awaiting && request.copy ? toReleaseItem(request) : null,
      request,
      attempts: [],
      attemptsAvailable: false,
    };
  }
  await begin();
  requireCapability("STAFF_AREA");
  const request = findRequest(requestId);
  const awaiting = request.status === "APPROVED" || request.status === "ON_HOLD";
  return out({
    item: awaiting ? toBookToRelease(request) : null,
    request: toStaffRequest(request),
    attempts: db.attempts.filter((a) => a.requestId === requestId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    attemptsAvailable: true,
  });
}

/** H2 POST /staff/borrowing-requests/:id/check-eligibility ("Check Penalties"). Live check; records a CHECKED attempt. */
export async function checkHandoverEligibility(requestId: UUID): Promise<PenaltyCheck> {
  if (!USE_MOCKS) {
    const id = positiveIntegerId(requestId, "Request id");
    try {
      const check = (await apiClient.get<unknown>(`/borrow-requests/${id}/pickup-check`)).data;
      return mapPickupCheck(check, String(id));
    } catch {
      const request = (await listStaffBorrowingRequests({ status: "APPROVED" }))
        .find((item) => item.id === String(id));
      if (!request) fail("NOT_FOUND", "We could not find an approved request awaiting handover.");
      const loans = await reservedStaffLoans();
      const reserved = loans.find((loan) => String(loan.requestId ?? loan.request_id) === String(id));
      if (!reserved) fail("NOT_FOUND", "The reserved borrowing record was not found.");
      const borrowId = positiveIntegerId(String(reserved.borrowId ?? reserved.borrow_id ?? reserved.id), "Borrow id");
      const check = (await apiClient.get<unknown>(`/borrowed-books/${borrowId}/pickup-check`)).data;
      return mapPickupCheck(check, request.student.id);
    }
  }
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
  if (!USE_MOCKS) {
    const id = positiveIntegerId(requestId, "Request id");
    const request = (await listStaffBorrowingRequests({ status: "APPROVED" }))
      .find((item) => item.id === String(id));
    if (!request) fail("NOT_FOUND", "We could not find an approved request awaiting handover.");
    const response = backendRow((await apiClient.post<unknown>(`/borrow-requests/${id}/reject-handover`, {
      reason_code: req.reasonCode,
      remarks: req.notes,
    })).data);
    return {
      ...request,
      status: requestStatus(response.status ?? "Rejected"),
      decisionReason: String(response.remarks ?? req.notes),
    };
  }
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
  if (!USE_MOCKS) {
    const id = positiveIntegerId(requestId, "Request id");
    const request = (await listStaffBorrowingRequests({ status: "APPROVED" }))
      .find((item) => item.id === String(id));
    if (!request?.copy) fail("NOT_FOUND", "The approved request or its assigned copy was not found.");
    const response = backendRow((await apiClient.post<unknown>(`/borrow-requests/${id}/confirm-handover`, {
      copy_barcode: req.copyBarcode,
    })).data);
    return {
      id: String(response.id ?? response.borrowId ?? response.borrow_id),
      bookId: request.bookId,
      bookTitle: request.bookTitle,
      copyId: request.copy.id,
      copyBarcode: request.copy.barcode,
      status: "ACTIVE",
      borrowedAt: String(response.borrowDate ?? response.borrowedAt ?? ""),
      dueAt: String(response.dueAt ?? response.dueDate ?? ""),
      returnedAt: null,
      renewedCount: 0,
    };
  }
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
  if (!USE_MOCKS) {
    const statusMap: Partial<Record<BorrowingRequestStatus, string>> = {
      PENDING: "Pending",
      APPROVED: "Approved",
      RELEASE_REJECTED: "Rejected",
      CLAIMED: "Fulfilled",
      CANCELLED: "Cancelled",
      EXPIRED: "Expired",
    };
    if (params.status === "ON_HOLD") {
      unsupportedOperation("Filtering the staff request queue by On Hold");
    }
    const statuses = params.status
      ? [statusMap[params.status]].filter((status): status is string => Boolean(status))
      : ["Pending", "Approved", "Rejected", "Cancelled", "Fulfilled", "Expired"];
    const rowGroups = await Promise.all(statuses.map((status) =>
      fetchPaginatedRows("/borrow-requests", { status }, "requests"),
    ));
    const rows = rowGroups.flat();
    const reserved = statuses.includes("Approved") ? await reservedStaffLoans() : [];
    const loansByRequest = new Map(reserved.map((loan) => [
      String(loan.requestId ?? loan.request_id),
      loan,
    ]));
    return rows
      .map((row) => mapStaffRequest(row, loansByRequest.get(String(row.id ?? row.request_id))))
      .filter((request) => !params.search || matches(
        params.search,
        request.bookTitle,
        request.student.firstName,
        request.student.lastName,
        request.student.studentNumber,
        request.copy?.barcode,
      ))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }
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

/** POST /borrow-requests/:id/review. The Server accepts review decisions for pending requests. */
export async function reviewBorrowingRequest(
  requestId: UUID,
  decision: "approve" | "reject",
  remarks = "",
): Promise<void> {
  if (!USE_MOCKS) {
    const id = positiveIntegerId(requestId, "Request id");
    if (decision === "reject" && !remarks.trim()) {
      fail("VALIDATION_ERROR", "A reason is required to reject a request.", 422);
    }
    await apiClient.post(`/borrow-requests/${id}/review`, {
      decision,
      ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
    });
    return;
  }
  unsupportedOperation("Reviewing pending borrowing requests");
}

/** P9 POST /staff/borrowing-requests/:id/cancel (proposed). Distinct from Hold, Reject Handover and Expire. */
export async function cancelBorrowingRequestAsStaff(requestId: UUID, reason: string): Promise<StaffBorrowingRequest> {
  await begin();
  const staff = requireCapability("STAFF_AREA");
  const why = need(reason, "A reason is required to cancel a request.");
  const request = findRequest(requestId);
  if (request.status !== "APPROVED" && request.status !== "ON_HOLD") fail("INVALID_STATE", "This request can no longer be cancelled.", 409);
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
  if (!USE_MOCKS) {
    const statuses = params.status === "ACTIVE" ? "Borrowed"
      : params.status === "RETURNED" ? "Returned"
        : params.status === "LOST" ? "Lost"
          : "Borrowed,Returned,Lost";
    return (await fetchPaginatedRows("/borrowed-books", {
      status: statuses,
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
    }, "loans"))
      .map(mapStaffLoan)
      .filter((loan) => !params.status || loan.status === params.status)
      .filter((loan) => !params.overdueOnly || loan.overdueDays > 0);
  }
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