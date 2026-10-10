import type {
  AcademicTerm,
  CorSummary,
  CorVerification,
  ReviewCorRejectRequest,
  StaffCorVerification,
  SubmitCorInput,
  UUID,
  VerificationStatus,
} from "@/types";
import type { MockCorRecord } from "@/data";
import { fail } from "@/utils/errors";
import { formatDate } from "@/utils/formatDate";
import { validateCorFile } from "@/utils/validators";
import { begin, corSummaryOf, currentTerm, studentName, studentRef, studentUserId, toCor } from "./mockEngine";
import { audit, commit, db, matches, newId, notify, notifyCorReviewers, nowIso, out, requireAccount, requireCapability, requireStudent } from "./mockStore";

// TEMPORARY MOCK IMPLEMENTATION: Replace with the real COR services (S4, S5, V1 to V3, P3, P17).
// NO real upload happens: the browser file is never stored or sent anywhere; only its name is kept.
// The real backend stores the file in PRIVATE storage and never returns a public URL or the storage key.
// Late submissions are allowed in the mock (TC-05 is TO CONFIRM).

/** P17 GET /academic-terms: read-only term list for the COR form and banners (any signed-in user). */
export async function listAcademicTerms(): Promise<AcademicTerm[]> {
  await begin();
  requireAccount();
  return out([...db.terms].sort((a, b) => a.startDate.localeCompare(b.startDate)));
}

/** S4 GET /me/verifications */
export async function listMyVerifications(): Promise<CorVerification[]> {
  await begin();
  const { student } = requireStudent();
  return out(db.cors.filter((c) => c.studentId === student.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map(toCor));
}

/** Display summary for the student dashboard and COR page, composed from S4 + P17. */
export async function getMyCorSummary(): Promise<CorSummary> {
  await begin();
  const { student } = requireStudent();
  return out(corSummaryOf(student.id));
}

/** S5 POST /me/verifications (multipart in the real API). Earlier PENDING uploads for the same term become SUPERSEDED. */
export async function submitCor(input: SubmitCorInput): Promise<CorVerification> {
  await begin();
  const { account, student } = requireStudent();
  const fileError = validateCorFile(input.file);
  if (fileError) {
    const tooLarge = fileError.includes("MB");
    fail(tooLarge ? "FILE_TOO_LARGE" : "FILE_TYPE_NOT_ALLOWED", fileError, 422);
  }
  const term = db.terms.find((t) => t.id === input.academicTermId);
  if (!term) fail("NOT_FOUND", "We could not find that academic term.");
  const open = currentTerm();
  if (term.status === "COMPLETED" || (term.status === "UPCOMING" && open && term.startDate < open.startDate)) {
    fail("VALIDATION_ERROR", "Submit your COR for the current or the next term.", 422);
  }
  db.cors.forEach((c) => {
    if (c.studentId === student.id && c.academicTermId === term.id && c.status === "PENDING") c.status = "SUPERSEDED";
  });
  const record: MockCorRecord = {
    id: newId(),
    studentId: student.id,
    academicTermId: term.id,
    termName: term.name,
    status: "PENDING",
    rejectionReason: null,
    originalFileName: input.file.name,
    submittedAt: nowIso(),
    reviewedAt: null,
    effectiveFrom: null,
    validUntil: null,
    reviewedByUserId: null,
    documentStorageKey: `mock://not-stored/${input.file.name}`, // MOCK: nothing is stored
  };
  db.cors.unshift(record);
  notify(account.user.id, "COR_SUBMITTED", "COR submitted", "Your COR was submitted and is awaiting review.", ["STUDENT_VERIFICATION", record.id]);
  notifyCorReviewers(record.id);
  commit();
  return out(toCor(record));
}

// ---------- staff review (Admin, or Librarian with COR_REVIEW) ----------

/** V1 GET /staff/verifications */
export async function listCorQueue(params: { status?: VerificationStatus; search?: string } = {}): Promise<StaffCorVerification[]> {
  await begin();
  requireCapability("COR_REVIEW");
  const rows = db.cors
    .filter((c) => !params.status || c.status === params.status)
    .map((c): StaffCorVerification => {
      const s = studentRef(c.studentId);
      return { ...toCor(c), student: { id: s.id, studentNumber: s.studentNumber, name: `${s.firstName} ${s.lastName}` } };
    })
    .filter((c) => matches(params.search, c.student.name, c.student.studentNumber, c.termName, c.originalFileName))
    .sort((a, b) => (a.status === "PENDING" ? 0 : 1) - (b.status === "PENDING" ? 0 : 1) || a.submittedAt.localeCompare(b.submittedAt));
  return out(rows);
}

const pendingRecord = (id: UUID): MockCorRecord => {
  const record = db.cors.find((c) => c.id === id);
  if (!record) fail("NOT_FOUND", "We could not find that COR submission.");
  if (record.status !== "PENDING") fail("INVALID_STATE", "This submission was already reviewed or replaced.", 409);
  return record;
};

/** V2 POST /staff/verifications/:id/approve. Valid from the term start to the term end. */
export async function approveCor(id: UUID): Promise<CorVerification> {
  await begin();
  const staff = requireCapability("COR_REVIEW");
  const record = pendingRecord(id);
  const term = db.terms.find((t) => t.id === record.academicTermId);
  if (!term) fail("NOT_FOUND", "The academic term no longer exists.");
  record.status = "APPROVED";
  record.reviewedAt = nowIso();
  record.reviewedByUserId = staff.user.id;
  record.effectiveFrom = term.startDate;
  record.validUntil = term.endDate;
  notify(studentUserId(record.studentId), "COR_APPROVED", "COR approved", `Your COR for ${term.name} was approved. It is valid from ${formatDate(term.startDate)}.`, ["STUDENT_VERIFICATION", record.id]);
  audit(staff, "COR_APPROVED", "STUDENT_VERIFICATION", record.id, `Approved the COR of ${studentName(record.studentId)} for ${term.name}.`);
  commit();
  return out(toCor(record));
}

/** V3 POST /staff/verifications/:id/reject. The reason is required and kept; the student may resubmit. */
export async function rejectCor(id: UUID, req: ReviewCorRejectRequest): Promise<CorVerification> {
  await begin();
  const staff = requireCapability("COR_REVIEW");
  if (!req.reason.trim()) fail("VALIDATION_ERROR", "A reason is required to reject a COR.", 422);
  const record = pendingRecord(id);
  record.status = "REJECTED";
  record.rejectionReason = req.reason.trim();
  record.reviewedAt = nowIso();
  record.reviewedByUserId = staff.user.id;
  notify(studentUserId(record.studentId), "COR_REJECTED", "COR not approved", `Your COR was not approved. Reason: ${record.rejectionReason}. Upload a corrected document for review.`, ["STUDENT_VERIFICATION", record.id]);
  audit(staff, "COR_REJECTED", "STUDENT_VERIFICATION", record.id, `Rejected the COR of ${studentName(record.studentId)}: ${record.rejectionReason}`);
  commit();
  return out(toCor(record));
}

/** P3 GET /staff/verifications/:id/document (proposed). The real API streams the PRIVATE file; the mock has no file. */
export async function getCorDocumentInfo(id: UUID): Promise<{ fileName: string; simulated: true }> {
  await begin();
  requireCapability("COR_REVIEW");
  const record = db.cors.find((c) => c.id === id);
  if (!record) fail("NOT_FOUND", "We could not find that COR submission.");
  return { fileName: record.originalFileName, simulated: true };
}