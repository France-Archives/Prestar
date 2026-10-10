import type { ISODate, ISODateTime, UUID } from "./api";
import type { VerificationStatus } from "./enums";
import type { AcademicTerm } from "./academicTerm";

// student_verifications -> CorVerification. documentStorageKey is NEVER returned.
export interface CorVerification {
  id: UUID;
  academicTermId: UUID;
  termName: string;
  status: VerificationStatus;
  rejectionReason: string | null; // required when REJECTED
  originalFileName: string;
  submittedAt: ISODateTime;
  reviewedAt: ISODateTime | null;
  effectiveFrom: ISODate | null;
  validUntil: ISODate | null;
}

/** V1 staff queue row adds the student. */
export interface StaffCorVerification extends CorVerification {
  student: { id: UUID; studentNumber: string; name: string };
}

/** Effective COR state for the CURRENT term (used by PenaltyCheck and the student dashboard). */
export type EffectiveCorStatus = VerificationStatus | "MISSING" | "EXPIRED" | "NOT_YET_EFFECTIVE";

/** Display summary composed from S4 + P17. */
export interface CorSummary {
  status: EffectiveCorStatus;
  currentTerm: AcademicTerm | null;
  latest: CorVerification | null;
}

/** S5 POST /me/verifications is multipart. The body fields are not defined in the source. TO CONFIRM. */
export interface SubmitCorInput {
  academicTermId: UUID;
  file: File;
}

/** V3 POST /staff/verifications/:id/reject */
export interface ReviewCorRejectRequest {
  reason: string;
}

/**
 * MOCK ONLY. Simulates an emailed verification / reset token. A real backend stores only a SHA-256 hash
 * and sends the raw token by email; the browser never sees it except in the link.
 */
export interface MockEmailToken {
  token: string;
  userId: UUID;
  purpose: "VERIFY_EMAIL" | "RESET_PASSWORD" | "INVITATION";
  expiresAt: ISODateTime;
  usedAt: ISODateTime | null;
}