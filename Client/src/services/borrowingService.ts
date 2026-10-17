import type { BorrowBatchItemRequest, BorrowBatchItemResult, BorrowingRequest, BorrowingRequestStatus, CreateBorrowingRequest, CreateBorrowingResponse, Loan, LoanStatus, UUID } from "@/types";
import type { MockBorrowingRequest } from "@/data";
import { describeError, fail } from "@/utils/errors";
import { addDaysIso, formatDate } from "@/utils/formatDate";
import { validateDuration } from "@/utils/validators";
import { assertEligible, begin, copyById, releaseCopy, setting, toLoan, toRequest } from "./mockEngine";
import { commit, db, newId, notify, nowIso, out, requireStudent } from "./mockStore";
import { createReservation } from "./reservationsService";

// TEMPORARY MOCK IMPLEMENTATION: Replace with the real borrowing API (B1 to B3, B7, B8).
// Eligibility, copy assignment, auto-approval and the pickup deadline are decided by the BACKEND.
// Here mockEngine simulates that. A request is NOT a loan: a loan exists only after staff confirm the handover.

/** B1 POST /borrowing-requests. Auto-approves when eligible and a copy is available; the copy is held for the pickup period. */
export async function createBorrowingRequest(req: CreateBorrowingRequest): Promise<CreateBorrowingResponse> {
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
      await createReservation({ bookId: item.bookId });
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