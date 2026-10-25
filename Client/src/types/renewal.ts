import type { ISODateTime } from "./api";
import type { RenewalStatus } from "./enums";
import type { StudentRef } from "./user";

// renewal_requests -> RenewalRequest
export interface RenewalRequest {
  id: string;
  loanId: string;
  requestedDurationDays: number;
  status: RenewalStatus;
  requestedAt: ISODateTime;
  approvedAt: ISODateTime | null;
  oldDueAt: ISODateTime | null;
  newDueAt: ISODateTime | null;
  decisionReason: string | null;
}

/** Renewal record joined with its title, as returned by the Server. */
export interface RenewalView extends RenewalRequest {
  bookTitle: string;
}

/** Staff view from GET /renewals. Renewals are decided automatically; staff only see them. */
export interface StaffRenewalView extends RenewalView {
  student: StudentRef;
}

/** POST /borrowed-books/:id/renew. */
export interface CreateRenewalRequest {
  requestedDurationDays: number;
}