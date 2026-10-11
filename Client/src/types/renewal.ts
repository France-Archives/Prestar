import type { ISODateTime, UUID } from "./api";
import type { AllowedDurationDays, RenewalStatus } from "./enums";
import type { StudentRef } from "./user";

// renewal_requests -> RenewalRequest
export interface RenewalRequest {
  id: UUID;
  loanId: UUID;
  requestedDurationDays: AllowedDurationDays;
  status: RenewalStatus;
  requestedAt: ISODateTime;
  approvedAt: ISODateTime | null;
  oldDueAt: ISODateTime | null;
  newDueAt: ISODateTime | null;
  decisionReason: string | null;
}

/** RenewalRequest joined with its title, for list pages. */
export interface RenewalView extends RenewalRequest {
  bookTitle: string;
}

/** Staff view (renewal management). Renewals are decided automatically; staff only see them. */
export interface StaffRenewalView extends RenewalView {
  student: StudentRef;
}

/** B6 POST /loans/:loanId/renewals */
export interface CreateRenewalRequest {
  requestedDurationDays: AllowedDurationDays;
}