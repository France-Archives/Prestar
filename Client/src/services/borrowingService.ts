import type { BorrowBatchItemRequest, BorrowBatchItemResult, BorrowingRequest, BorrowingRequestStatus, CreateBorrowingRequest, CreateBorrowingResponse, Loan, LoanStatus, UUID } from "@/types";
import type { MockBorrowingRequest } from "@/data";
import { apiClient } from "@/services/apiClient";
import { USE_MOCKS } from "@/utils/constants";
import { ApiError, describeError, fail } from "@/utils/errors";
import { addDaysIso, formatDate } from "@/utils/formatDate";
import { validateDuration } from "@/utils/validators";
import { assertEligible, begin, copyById, releaseCopy, setting, toLoan, toRequest } from "./mockEngine";
import { commit, db, newId, notify, nowIso, out, requireStudent } from "./mockStore";
import { createReservation } from "./reservationsService";

type BackendRow = Record<string, unknown>;

function backendRow(value: unknown): BackendRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("UNKNOWN", "The Server returned an invalid borrowing response.");
  }
  return value as BackendRow;
}

function backendStatus(value: unknown): BorrowingRequestStatus {
  const normalized = typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "_") : "";
  const statuses: Record<string, BorrowingRequestStatus> = {
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    ON_HOLD: "ON_HOLD",
    REJECTED: "RELEASE_REJECTED",
    RELEASE_REJECTED: "RELEASE_REJECTED",
    FULFILLED: "CLAIMED",
    CLAIMED: "CLAIMED",
    EXPIRED: "EXPIRED",
    CANCELLED: "CANCELLED",
  };
  const status = statuses[normalized];
  if (!status) throw new ApiError("UNKNOWN", `The Server returned an unsupported request status: ${String(value)}.`);
  return status;
}

function mapBackendRequest(value: unknown): BorrowingRequest {
  const row = backendRow(value);
  const book = row.book && typeof row.book === "object" ? row.book as BackendRow : null;
  const requestedDurationDays = Number(row.requestedDurationDays ?? row.requested_days);
  if (!Number.isSafeInteger(requestedDurationDays) || requestedDurationDays < 1) {
    throw new ApiError("UNKNOWN", "The Server returned a borrowing request without a valid duration.");
  }
  return {
    id: String(row.id ?? row.requestId ?? row.request_id),
    bookId: String(row.bookId ?? row.book_id ?? book?.id ?? ""),
    bookTitle: String(row.bookTitle ?? book?.title ?? "Unknown title"),
    assignedCopyId: row.assignedCopyId == null && row.copy_id == null
      ? null
      : String(row.assignedCopyId ?? row.copy_id),
    requestedDurationDays,
    status: backendStatus(row.status),
    requestedAt: String(row.requestedAt ?? row.request_date ?? ""),
    approvedAt: row.approvedAt == null && row.reviewed_at == null
      ? null
      : String(row.approvedAt ?? row.reviewed_at),
    pickupDeadline: row.pickupDeadline == null && row.pickup_deadline == null
      ? null
      : String(row.pickupDeadline ?? row.pickup_deadline),
    claimedAt: row.claimedAt == null && row.picked_up_at == null
      ? null
      : String(row.claimedAt ?? row.picked_up_at),
    decisionReason: typeof (row.decisionReason ?? row.remarks) === "string"
      ? String(row.decisionReason ?? row.remarks)
      : null,
  };
}

function positiveIntegerId(value: UUID, label: string): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    fail("VALIDATION_ERROR", `${label} must be a positive integer.`, 400);
  }
  return Number(value);
}

function mapBackendLoan(value: unknown): Loan {
  const row = backendRow(value);
  const book = row.book && typeof row.book === "object" ? row.book as BackendRow : null;
  const copy = row.copy && typeof row.copy === "object" ? row.copy as BackendRow : null;
  const statusText = typeof row.status === "string" ? row.status.trim().toUpperCase() : "";
  const status: LoanStatus = statusText === "BORROWED" || statusText === "RESERVED"
    ? "ACTIVE"
    : statusText === "RETURNED" || statusText === "LOST"
      ? statusText
      : (() => { throw new ApiError("UNKNOWN", `The Server returned an unsupported loan status: ${String(row.status)}.`); })();
  return {
    id: String(row.id ?? row.borrowId ?? row.borrow_id),
    bookId: String(row.bookId ?? row.book_id ?? book?.id ?? ""),
    bookTitle: String(row.bookTitle ?? book?.title ?? "Unknown title"),
    copyId: String(row.copyId ?? row.copy_id ?? ""),
    copyBarcode: String(row.copyBarcode ?? row.accessionNo ?? row.accession_no ?? copy?.accessionNo ?? copy?.barcode ?? ""),
    status,
    borrowedAt: String(row.borrowedAt ?? row.borrowDate ?? row.borrow_date ?? ""),
    dueAt: String(row.dueAt ?? row.dueDate ?? row.due_date ?? ""),
    returnedAt: row.returnedAt == null && row.returned_at == null
      ? null
      : String(row.returnedAt ?? row.returned_at),
    renewedCount: Number(row.renewedCount ?? row.renewed_count ?? 0),
  };
}

async function listAllBackendRequests(): Promise<BorrowingRequest[]> {
  const limit = 50;
  const first = backendRow((await apiClient.get("/borrow-requests/mine", { params: { page: 1, limit } })).data);
  const requests = Array.isArray(first.requests) ? first.requests : [];
  const pagination = first.pagination && typeof first.pagination === "object"
    ? first.pagination as BackendRow
    : {};
  const totalPages = Math.max(1, Number(pagination.totalPages ?? 1));
  const rows = [...requests];
  for (let page = 2; page <= totalPages; page += 1) {
    const response = backendRow((await apiClient.get("/borrow-requests/mine", { params: { page, limit } })).data);
    if (Array.isArray(response.requests)) rows.push(...response.requests);
  }
  return rows.map(mapBackendRequest);
}

// The mock implementation is retained for development; live calls use the Server's current contracts.
// Eligibility, copy assignment, auto-approval and the pickup deadline are decided by the BACKEND.
// Here mockEngine simulates that. A request is NOT a loan: a loan exists only after staff confirm the handover.

/** B1 POST /borrowing-requests. Auto-approves when eligible and a copy is available; the copy is held for the pickup period. */
export async function createBorrowingRequest(req: CreateBorrowingRequest): Promise<CreateBorrowingResponse> {
  if (!USE_MOCKS) {
    const bookId = positiveIntegerId(req.bookId, "Book id");
    const response = backendRow((await apiClient.post("/borrow-requests", {
      book_id: bookId,
      requested_days: req.requestedDurationDays,
    })).data);
    if (typeof response.message !== "string") {
      throw new ApiError("UNKNOWN", "The Server created a borrowing request without returning its message.");
    }
    return { ...mapBackendRequest(response.request), message: response.message };
  }
  await begin();
  const { account, student } = requireStudent();
  const durationError = validateDuration(req.requestedDurationDays);
  if (durationError) fail("INVALID_DURATION", durationError, 422);
  const book = db.books.find((b) => b.id === req.bookId && !b.isArchived);
  if (!book) fail("NOT_FOUND", "We could not find that book.");

  assertEligible(student.id, { includeLimits: true, bookId: book.id });

  const copy = db.copies.filter((c) => c.bookId === book.id && c.status === "AVAILABLE").sort((a, b) => a.barcode.localeCompare(b.barcode))[0];
  if (!copy) fail("NO_COPY_AVAILABLE", undefined, 409, { canReserve: true });

  copy.status = "RESERVED";
  const now = nowIso();
  const request: MockBorrowingRequest = {
    id: newId(),
    studentId: student.id,
    bookId: book.id,
    bookTitle: book.title,
    assignedCopyId: copy.id,
    requestedDurationDays: req.requestedDurationDays,
    status: "APPROVED",
    requestedAt: now,
    approvedAt: now,
    pickupDeadline: addDaysIso(now, setting("PICKUP_HOLD_DAYS")),
    claimedAt: null,
    decisionReason: null,
  };
  db.requests.unshift(request);
  notify(
    account.user.id,
    "BORROW_REQUEST_APPROVED",
    "Request approved",
    `Your request for ${book.title} was approved. Pick it up by ${formatDate(request.pickupDeadline)} at the library.`,
    ["BORROWING_REQUEST", request.id],
  );
  commit();
  return out({ ...toRequest(request), message: "Your request was approved. Pick up the book before the deadline." });
}

/** B2 GET /me/borrowing-requests */
export async function listMyBorrowingRequests(params: { status?: BorrowingRequestStatus } = {}): Promise<BorrowingRequest[]> {
  if (!USE_MOCKS) {
    const rows = await listAllBackendRequests();
    return params.status ? rows.filter((request) => request.status === params.status) : rows;
  }
  await begin();
  const { student } = requireStudent();
  return out(
    db.requests
      .filter((r) => r.studentId === student.id && (!params.status || r.status === params.status))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      .map(toRequest),
  );
}

/** B3 POST /borrowing-requests/:id/cancel. Allowed from APPROVED / ON_HOLD (TC-11 baseline). The held copy is released. */
export async function cancelBorrowingRequest(requestId: UUID): Promise<BorrowingRequest> {
  if (!USE_MOCKS) {
    const id = positiveIntegerId(requestId, "Request id");
    await apiClient.post(`/borrow-requests/${id}/cancel`);
    const updated = (await listAllBackendRequests()).find((request) => request.id === String(id));
    if (!updated) throw new ApiError("UNKNOWN", "The Server cancelled the request but it was not present in the refreshed request list.");
    return updated;
  }
  await begin();
  const { student } = requireStudent();
  const request = db.requests.find((r) => r.id === requestId && r.studentId === student.id);
  if (!request) fail("NOT_FOUND", "We could not find that request.");
  if (request.status !== "APPROVED" && request.status !== "ON_HOLD") {
    fail("INVALID_STATE", "This request can no longer be cancelled.", 409);
  }
  request.status = "CANCELLED";
  request.decisionReason = "Cancelled by the student";
  const copy = request.assignedCopyId ? copyById(request.assignedCopyId) : undefined;
  if (copy && copy.status === "RESERVED") releaseCopy(copy);
  commit();
  return out(toRequest(request));
}

/** B7 GET /me/loans. Active loans first, nearest due date first. */
export async function listMyLoans(params: { status?: LoanStatus } = {}): Promise<Loan[]> {
  if (!USE_MOCKS) {
    const backendStatus = params.status === "ACTIVE" ? "Borrowed" : params.status === "RETURNED" ? "Returned" : params.status === "LOST" ? "Lost" : undefined;
    const response = backendRow((await apiClient.get("/borrowed-books/mine", {
      params: backendStatus ? { status: backendStatus } : undefined,
    })).data);
    const rows = Array.isArray(response.loans) ? response.loans : [];
    return rows.map(mapBackendLoan).filter((loan) => !params.status || loan.status === params.status);
  }
  await begin();
  const { student } = requireStudent();
  return out(
    db.loans
      .filter((l) => l.studentId === student.id && (!params.status || l.status === params.status))
      .sort((a, b) => (a.status === "ACTIVE" ? 0 : 1) - (b.status === "ACTIVE" ? 0 : 1) || (a.status === "ACTIVE" ? a.dueAt.localeCompare(b.dueAt) : b.borrowedAt.localeCompare(a.borrowedAt)))
      .map(toLoan),
  );
}

/** B8 GET /me/history: closed loans (RETURNED, LOST), newest first. */
export async function getMyHistory(): Promise<Loan[]> {
  if (!USE_MOCKS) {
    const [returned, lost] = await Promise.all([
      apiClient.get("/borrowed-books/mine", { params: { status: "Returned" } }),
      apiClient.get("/borrowed-books/mine", { params: { status: "Lost" } }),
    ]);
    const rows = [returned.data, lost.data].flatMap((value) => {
      const response = backendRow(value);
      return Array.isArray(response.loans) ? response.loans : [];
    });
    return rows.map(mapBackendLoan);
  }
  await begin();
  const { student } = requireStudent();
  return out(
    db.loans
      .filter((l) => l.studentId === student.id && l.status !== "ACTIVE")
      .sort((a, b) => b.borrowedAt.localeCompare(a.borrowedAt))
      .map(toLoan),
  );
}

/** Process each title independently through the existing single-copy request and reservation services. */
export async function submitBorrowBatchItem(item: BorrowBatchItemRequest): Promise<BorrowBatchItemResult> {
  if (!USE_MOCKS) {
    const { getBook } = await import("./booksService");
    const bookTitle = (await getBook(item.bookId)).title;
    if (!Number.isInteger(item.requestedQuantity) || item.requestedQuantity < 1 || !Number.isInteger(item.borrowQuantity) || item.borrowQuantity < 0 || item.borrowQuantity > item.requestedQuantity) {
      fail("VALIDATION_ERROR", "Choose a valid quantity before submitting.", 422);
    }
    const requests: BorrowingRequest[] = [];
    const messages: string[] = [];
    let reservationCreated = false;
    for (let index = 0; index < item.borrowQuantity; index += 1) {
      try {
        requests.push(await createBorrowingRequest({
          bookId: item.bookId,
          requestedDurationDays: item.requestedDurationDays,
        }));
      } catch (error) {
        messages.push(describeError(error));
        break;
      }
    }
    const remainder = item.requestedQuantity - requests.length;
    if (remainder > 0 && item.reserveRemainder) {
      try {
        await createReservation({ bookId: item.bookId, requestedDurationDays: item.requestedDurationDays });
        reservationCreated = true;
      } catch (error) {
        messages.push(describeError(error));
      }
    }
    const unfulfilledQuantity = Math.max(0, item.requestedQuantity - requests.length - (reservationCreated ? 1 : 0));
    if (remainder > 0 && !item.reserveRemainder) messages.push(`${remainder} requested ${remainder === 1 ? "copy was" : "copies were"} not requested or reserved.`);
    if (reservationCreated && remainder > 1) messages.push("The Server reservation workflow queues one copy per title; additional copies in the remainder are not represented.");
    if (item.borrowQuantity === 0 && !reservationCreated) messages.push("No borrowing request or reservation was submitted.");
    return {
      bookId: item.bookId,
      bookTitle,
      requestedQuantity: item.requestedQuantity,
      requestedDurationDays: item.requestedDurationDays,
      requests,
      reservationCreated,
      unfulfilledQuantity,
      messages,
    };
  }
  if (!Number.isInteger(item.requestedQuantity) || item.requestedQuantity < 1 || !Number.isInteger(item.borrowQuantity) || item.borrowQuantity < 0 || item.borrowQuantity > item.requestedQuantity) {
    fail("VALIDATION_ERROR", "Choose a valid quantity before submitting.", 422);
  }

  const bookTitle = db.books.find((book) => book.id === item.bookId)?.title ?? "Book";
  const requests: BorrowingRequest[] = [];
  const messages: string[] = [];
  let reservationCreated = false;
  let attempted = 0;

  for (let index = 0; index < item.borrowQuantity; index += 1) {
    attempted += 1;
    try {
      const request = await createBorrowingRequest({ bookId: item.bookId, requestedDurationDays: item.requestedDurationDays });
      requests.push(request);
    } catch (error) {
      messages.push(describeError(error));
      break;
    }
  }

  const remainder = item.requestedQuantity - requests.length;
  if (remainder > 0 && item.reserveRemainder) {
    try {
      await createReservation({ bookId: item.bookId, requestedDurationDays: item.requestedDurationDays });
      reservationCreated = true;
    } catch (error) {
      messages.push(describeError(error));
    }
  }

  const unfulfilledQuantity = Math.max(0, item.requestedQuantity - requests.length - (reservationCreated ? 1 : 0));
  if (remainder > 0 && !item.reserveRemainder) messages.push(`${remainder} requested ${remainder === 1 ? "copy was" : "copies were"} not requested or reserved.`);
  if (reservationCreated && remainder > 1) messages.push("The current reservation workflow queues one copy per title; additional copies in the remainder are not represented.");
  if (attempted === 0 && !reservationCreated) messages.push("No borrowing request or reservation was submitted.");

  return out({
    bookId: item.bookId,
    bookTitle,
    requestedQuantity: item.requestedQuantity,
    requestedDurationDays: item.requestedDurationDays,
    requests,
    reservationCreated,
    unfulfilledQuantity,
    messages,
  });
}