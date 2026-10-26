import type { ISODateTime, UUID } from "./api";
import type { FineStatus, FineType } from "./enums";
import type { StudentRef } from "./user";

// fines -> FineSummary. paidAmount and balance are computed.
export interface FineSummary {
  id: UUID;
  fineType: FineType | string;
  amount: number; // 100 / 200 / 500, chosen by the server
  paidAmount: number;
  balance: number;
  status: FineStatus;
  recordedAt: ISODateTime;
}

/** Staff fine shape mapped from GET /api/fines and student penalties. */
export interface StaffFine extends FineSummary {
  penaltyId?: UUID;
  student: StudentRef & { email?: string; userId?: UUID };
  loanId?: UUID | null;
  borrowId?: UUID | null;
  returnId?: UUID | null;
  bookTitle: string;
  book?: { id: UUID; title: string; isbn?: string | null } | null;
  fineTypeLabel?: string;
  statusLabel?: string;
  notes: string | null;
  waivedAt?: ISODateTime | null;
  waivedBy?: string | null;
  waiveRemarks?: string | null;
}

/** Mock-only assessment request; the live Server creates fines during circulation. */
export interface CreateFineRequest {
  fineType: FineType;
  notes: string;
}

/** POST /api/fines/:id/waive (reason required and audited). */
export interface WaiveFineRequest {
  reason: string;
}