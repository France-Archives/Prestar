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
import { apiClient } from "@/services/apiClient";
import { USE_MOCKS } from "@/utils/constants";
import { ApiError, fail, unsupportedOperation } from "@/utils/errors";
import { getStudentDashboard } from "./reportsService";
import { formatDate } from "@/utils/formatDate";
import { validateCorFile } from "@/utils/validators";
import { begin, corSummaryOf, currentTerm, studentName, studentRef, studentUserId, toCor } from "./mockEngine";
import { audit, commit, db, matches, newId, notify, notifyCorReviewers, nowIso, out, requireAccount, requireCapability, requireStudent } from "./mockStore";

type BackendRow = Record<string, unknown>;

function backendRow(value: unknown): BackendRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("UNKNOWN", "The Server returned an invalid verification response.");
  }
  return value as BackendRow;
}

function mapBackendTerm(value: unknown): AcademicTerm {
  const row = backendRow(value);
  return {
    id: String(row.id ?? row.term_id),
    name: String(row.name ?? row.term_name ?? ""),
    startDate: String(row.startDate ?? row.start_date ?? ""),
    endDate: String(row.endDate ?? row.end_date ?? ""),
    corDeadline: String(row.corDeadline ?? row.cor_deadline ?? ""),
    status: String(row.status ?? "").trim().toUpperCase() as AcademicTerm["status"],
  };
}

function mapBackendVerification(value: unknown): CorVerification {
  const row = backendRow(value);
  const statusText = typeof row.status === "string" ? row.status.trim().toUpperCase() : "";
  const statusByValue: Record<string, VerificationStatus> = {
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    SUPERSEDED: "SUPERSEDED",
    EXPIRED: "EXPIRED",
  };
  const status = statusByValue[statusText];
  if (!status) throw new ApiError("UNKNOWN", `The Server returned an unsupported verification status: ${String(row.status)}.`);
  return {
    id: String(row.id ?? row.verification_id),
    academicTermId: String(row.academicTermId ?? row.termId ?? row.term_id ?? ""),
    termName: String(row.termName ?? row.term_name ?? ""),
    status,
    rejectionReason: typeof (row.rejectionReason ?? row.remarks) === "string"
      ? String(row.rejectionReason ?? row.remarks)
      : null,
    originalFileName: String(row.originalFileName ?? row.original_file_name ?? row.proofFile ?? row.proof_file ?? ""),
    submittedAt: String(row.submittedAt ?? row.submitted_at ?? ""),
    reviewedAt: row.reviewedAt == null && row.reviewed_at == null
      ? null
      : String(row.reviewedAt ?? row.reviewed_at),
    effectiveFrom: row.effectiveFrom == null && row.validFrom == null && row.valid_from == null
      ? null
      : String(row.effectiveFrom ?? row.validFrom ?? row.valid_from),
    validUntil: row.validUntil == null && row.valid_until == null
      ? null
      : String(row.validUntil ?? row.valid_until),
  };
}

function backendStatus(status: VerificationStatus): string {
  return status === "PENDING" ? "Pending"
    : status === "APPROVED" ? "Approved"
      : status === "REJECTED" ? "Rejected"
        : status === "EXPIRED" ? "Expired"
          : "Superseded";
}

// Live Server submission records the selected filename; it does not receive or store the document bytes.
// Late submissions are allowed in the mock (TC-05 is TO CONFIRM).

/** P17 GET /academic-terms: read-only term list for the COR form and banners (any signed-in user). */
export async function listAcademicTerms(): Promise<AcademicTerm[]> {
  if (!USE_MOCKS) {
    const response = (await apiClient.get<unknown>("/academic-terms")).data;
    if (!Array.isArray(response)) throw new ApiError("UNKNOWN", "The Server returned an invalid academic-term list.");
    return response.map(mapBackendTerm);
  }
  await begin();
  requireAccount();
  return out([...db.terms].sort((a, b) => a.startDate.localeCompare(b.startDate)));
}

/** S4 GET /me/verifications */
export async function listMyVerifications(): Promise<CorVerification[]> {
  if (!USE_MOCKS) {
    const response = (await apiClient.get<unknown>("/me/verifications")).data;
    if (!Array.isArray(response)) throw new ApiError("UNKNOWN", "The Server returned an invalid verification list.");
    return response.map(mapBackendVerification);
  }
  await begin();
  const { student } = requireStudent();
  return out(db.cors.filter((c) => c.studentId === student.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map(toCor));
}

/** Display summary for the student dashboard and COR page, composed from S4 + P17. */
export async function getMyCorSummary(): Promise<CorSummary> {
  if (!USE_MOCKS) {
    const [dashboard, verifications, terms] = await Promise.all([
      getStudentDashboard(),
      listMyVerifications(),
      listAcademicTerms(),
    ]);
    const dashboardTerm = dashboard.cor.currentTerm ?? null;
    return {
      status: dashboard.cor.status,
      currentTerm: dashboardTerm ? terms.find((term) => term.id === dashboardTerm.id) ?? null : null,
      latest: verifications[0] ?? null,
    };
  }
  await begin();
  const { student } = requireStudent();
  return out(corSummaryOf(student.id));
}

/** S5 POST /me/verifications (multipart in the real API). Earlier PENDING uploads for the same term become SUPERSEDED. */
export async function submitCor(input: SubmitCorInput): Promise<CorVerification> {
  if (!USE_MOCKS) {
    const response = (await apiClient.post<unknown>("/me/verifications", {
      proof_file: input.file.name,
    })).data;
    return mapBackendVerification(response);
  }
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

// ---------- staff review (Admin and Librarian) ----------

/** V1 GET /staff/verifications */
export async function listCorQueue(params: { status?: VerificationStatus; search?: string } = {}): Promise<StaffCorVerification[]> {
  if (!USE_MOCKS) {
    const response = (await apiClient.get<unknown>("/staff/verifications", {
      params: {
        ...(params.status ? { status: backendStatus(params.status) } : {}),
        ...(params.search?.trim() ? { search: params.search.trim() } : {}),
      },
    })).data;
    if (!Array.isArray(response)) throw new ApiError("UNKNOWN", "The Server returned an invalid verification queue.");
    return response.map((value): StaffCorVerification => {
      const row = backendRow(value);
      const student = row.student && typeof row.student === "object" ? row.student as BackendRow : {};
      return {
        ...mapBackendVerification(row),
        student: {
          id: String(student.id ?? ""),
          studentNumber: String(student.studentNumber ?? student.student_number ?? ""),
          name: String(student.name ?? ""),
        },
      };
    });
  }
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
  if (!USE_MOCKS) {
    const response = (await apiClient.post<unknown>(`/staff/verifications/${encodeURIComponent(id)}/approve`, {})).data;
    return mapBackendVerification(response);
  }
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
  if (!req.reason.trim()) fail("VALIDATION_ERROR", "A reason is required to reject a COR.", 422);
  if (!USE_MOCKS) {
    const response = (await apiClient.post<unknown>(`/staff/verifications/${encodeURIComponent(id)}/reject`, {
      reason: req.reason,
    })).data;
    return mapBackendVerification(response);
  }
  await begin();
  const staff = requireCapability("COR_REVIEW");
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

/** GET /staff/verifications/:id/document streams the private file to authorized reviewers. */
export async function getCorDocument(id: UUID): Promise<Blob> {
  if (USE_MOCKS) unsupportedOperation("Viewing submitted COR documents");
  const response = await apiClient.get<Blob>(
    `/staff/verifications/${encodeURIComponent(id)}/document`,
    { responseType: "blob" },
  );
  return response.data;
}