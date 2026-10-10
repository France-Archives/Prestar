import type { ISODateTime, UUID } from "./api";
import type { AllowedDurationDays, BorrowingRequestStatus, LoanStatus } from "./enums";
import type { CopyRef } from "./book";
import type { StudentRef } from "./user";

// borrowing_requests -> BorrowingRequest. A request is NOT a loan.
export interface BorrowingRequest {
  id: UUID;
  bookId: UUID;
  bookTitle: string;
  assignedCopyId: UUID | null;
  requestedDurationDays: AllowedDurationDays;
  status: BorrowingRequestStatus;
  requestedAt: ISODateTime;
  approvedAt: ISODateTime | null;
  pickupDeadline: ISODateTime | null; // DB column claim_deadline
  claimedAt: ISODateTime | null;
  decisionReason: string | null;
}

/** P8 GET /staff/borrowing-requests (proposed): request with student and assigned copy. */
export interface StaffBorrowingRequest extends BorrowingRequest {
  student: StudentRef;
  copy: CopyRef | null;
}

// loans -> Loan. Created only when staff confirms the physical handover.
export interface Loan {
  id: UUID;
  bookId: UUID;
  bookTitle: string;
  copyId: UUID;
  copyBarcode: string;
  status: LoanStatus;
  borrowedAt: ISODateTime;
  dueAt: ISODateTime;
  returnedAt: ISODateTime | null;
  renewedCount: number;
}

/** P4 GET /staff/loans (proposed). overdueDays is a display value, calendar days past dueAt in Asia/Manila. */
export interface StaffLoan extends Loan {
  student: StudentRef;
  overdueDays: number;
}

// ----- Request bodies -----

/** B1 POST /borrowing-requests. Student identity comes from the session, never the body. */
export interface CreateBorrowingRequest {
  bookId: UUID;
  requestedDurationDays: AllowedDurationDays;
}

/** B1 201 response: the approved request plus a message. */
export interface CreateBorrowingResponse extends BorrowingRequest {
  message: string;
}