import type { ISODateTime, UUID } from "./api";
import type { FineStatus, FineType } from "./enums";
import type { StudentRef } from "./user";

// fines -> FineSummary. paidAmount and balance are computed.
export interface FineSummary {
  id: UUID;
  fineType: FineType;
  amount: number; // 100 / 200 / 500, chosen by the server
  paidAmount: number;
  balance: number;
  status: FineStatus;
  recordedAt: ISODateTime;
}

/** P10 GET /staff/fines (proposed). There is NO student "My Fines" page. */
export interface StaffFine extends FineSummary {
  student: StudentRef;
  loanId: UUID;
  bookTitle: string;
  notes: string | null;
}

/** F1 POST /staff/loans/:loanId/fines. Amount is chosen by the server, never sent. */
export interface CreateFineRequest {
  fineType: FineType;
  notes: string;
}

/** P11 POST /staff/fines/:fineId/waive (Admin only, audited). */
export interface WaiveFineRequest {
  reason: string;
}