import type { ISODateTime, UUID } from "./api";
import type {
  AccountStatus,
  AllowedDurationDays,
  BookCopyStatus,
  BorrowingRequestStatus,
  CopyCondition,
  ErrorCode,
  FineType,
  HandoverAction,
} from "./enums";
import type { EffectiveCorStatus } from "./verification";
import type { Loan } from "./borrowing";

// Penalty check -> PenaltyCheck (computed by the server only).
export interface PenaltyReason {
  code: ErrorCode;
  message: string;
}

export interface PenaltyOverdueLoan {
  loanId: UUID;
  bookTitle: string;
  dueAt: ISODateTime;
  overdueDays: number;
}

export interface PenaltyUnpaidFine {
  fineId: UUID;
  fineType: FineType;
  amount: number;
  paidAmount: number;
  balance: number;
}

export interface PenaltyCheck {
  studentId: UUID;
  checkedAt: ISODateTime;
  eligible: boolean; // server-computed only
  accountStatus: AccountStatus;
  emailVerified: boolean;
  corStatus: EffectiveCorStatus;
  activeCommitmentCount: number;
  reasons: PenaltyReason[];
  overdueLoans: PenaltyOverdueLoan[];
  unpaidFines: PenaltyUnpaidFine[];
}

// Books to Release row -> BookToRelease (derived)
export interface BookToRelease {
  requestId: UUID;
  student: { id: UUID; studentNumber: string; firstName: string; lastName: string };
  book: { id: UUID; title: string };
  copy: { id: UUID; barcode: string };
  requestedDurationDays: AllowedDurationDays;
  approvedAt: ISODateTime;
  pickupDeadline: ISODateTime;
  status: Extract<BorrowingRequestStatus, "APPROVED" | "ON_HOLD">;
}

/** One row of handover_attempts, shown on the handover details page. */
export interface HandoverAttempt {
  id: UUID;
  requestId: UUID;
  action: HandoverAction;
  reasonCode: string | null;
  notes: string | null;
  staffName: string;
  createdAt: ISODateTime;
}

// ----- Request bodies -----

/** H3 POST /staff/borrowing-requests/:id/hold (reason required) */
export interface HoldHandoverRequest {
  reasonCode: string;
  notes: string;
}
/** H4 POST /staff/borrowing-requests/:id/reject-handover (reason required) */
export interface RejectHandoverRequest {
  reasonCode: string;
  notes: string;
}
/** H5 POST /staff/borrowing-requests/:id/claim */
export interface ClaimRequest {
  copyBarcode: string;
}
/** H6 POST /staff/loans/:loanId/return */
export interface ReturnRequest {
  condition: CopyCondition;
  notes?: string;
}
/**
 * H7 POST /staff/loans/:loanId/mark-lost. The body is not defined in the source. TO CONFIRM.
 * The server creates the LOST_BOOK fine itself. Staff must confirm with the student first (UI checkbox).
 */
export interface MarkLostRequest {
  notes?: string | null;
}

/** Result of a return: shown in the UI so staff see what happened to the copy. */
export interface ReturnResult {
  loan: Loan;
  copyStatus: BookCopyStatus;
  offeredToReservationId: UUID | null;
}