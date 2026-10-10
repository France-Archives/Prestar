import type { CorVerification, MockEmailToken, UUID, VerificationStatus } from "@/types";
import { NS, at, uid } from "./mockHelpers";
import { TERM_ID, termById, termNameOf } from "./mockAcademicTerms";
import { STUDENT_ID, USER_ID } from "./mockUsers";

// TEMPORARY MOCK IMPLEMENTATION: fake COR review records and fake emailed tokens.
// Replace with the real authentication/COR services (A4 to A7, S4, S5, V1 to V3, P3).
// - COR files are NOT stored: no real upload happens in the mock. The service keeps only the file name.
// - documentStorageKey exists only so the mock mirrors the DB; the service MUST strip it before returning
//   (the real API never returns it).
// - Email tokens are simulated. A real backend emails a link and stores only a SHA-256 hash.

export type MockCorRecord = CorVerification & {
  studentId: UUID;
  reviewedByUserId: UUID | null;
  documentStorageKey: string;
};

export const verificationId = (n: number): UUID => uid(NS.verification, n);

function cor(
  n: number,
  studentId: UUID,
  termId: UUID,
  status: VerificationStatus,
  submittedDays: number,
  fileName: string,
  reviewedDays: number | null = null,
  reviewer: UUID | null = null,
  reason: string | null = null,
): MockCorRecord {
  const term = termById(termId);
  const approved = status === "APPROVED";
  return {
    id: verificationId(n),
    studentId,
    academicTermId: termId,
    termName: termNameOf(termId),
    status,
    rejectionReason: reason,
    originalFileName: fileName,
    submittedAt: at(submittedDays),
    reviewedAt: reviewedDays === null ? null : at(reviewedDays),
    effectiveFrom: approved ? term.startDate : null,
    validUntil: approved ? term.endDate : null,
    reviewedByUserId: reviewer,
    documentStorageKey: `mock://cor/${verificationId(n)}-${fileName}`,
  };
}

const { current, past, next } = TERM_ID;

export const MOCK_COR_RECORDS: MockCorRecord[] = [
  // Ana: approved for the previous and the current term
  cor(1, STUDENT_ID.ana, past, "APPROVED", -250, "ana-cor-2nd-sem.pdf", -249, USER_ID.leo),
  cor(2, STUDENT_ID.ana, current, "APPROVED", -66, "ana-cor-1st-sem.pdf", -65, USER_ID.leo),
  // Ben: first upload superseded by a newer one (approved); also a next-term upload waiting for review
  cor(3, STUDENT_ID.ben, current, "SUPERSEDED", -55, "ben-cor-blurry.jpg"),
  cor(4, STUDENT_ID.ben, current, "APPROVED", -54, "ben-cor.pdf", -53, USER_ID.admin),
  cor(5, STUDENT_ID.ben, next, "PENDING", -2, "ben-cor-next-term.pdf"),
  // Carla and Felix: approved for the current term
  cor(6, STUDENT_ID.carla, current, "APPROVED", -64, "carla-cor.pdf", -63, USER_ID.leo),
  cor(7, STUDENT_ID.felix, current, "APPROVED", -62, "felix-cor.pdf", -61, USER_ID.leo),
  // Gina: first rejected, then resubmitted (history is kept; the new upload is waiting)
  cor(8, STUDENT_ID.gina, current, "REJECTED", -5, "gina-cor-v1.jpg", -4, USER_ID.leo, "The image is blurry and the course codes are unreadable."),
  cor(9, STUDENT_ID.gina, current, "PENDING", -1, "gina-cor-v2.pdf"),
  // Dan has no COR at all, so his effective COR status is MISSING. Ella is not verified yet.
];

/** Demo links: /verify-email?token=demo-verify-ella and /accept-invitation?token=demo-invite-nico */
export const MOCK_EMAIL_TOKENS: MockEmailToken[] = [
  { token: "demo-verify-ella", userId: USER_ID.ella, purpose: "VERIFY_EMAIL", expiresAt: at(1), usedAt: null },
  { token: "demo-invite-nico", userId: USER_ID.nico, purpose: "INVITATION", expiresAt: at(5), usedAt: null },
];