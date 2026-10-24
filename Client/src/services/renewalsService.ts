import type { CreateRenewalRequest, RenewalStatus, RenewalView, StaffRenewalView, UUID } from "@/types";
import type { MockRenewal } from "@/data";
import { apiClient } from "@/services/apiClient";
import { USE_MOCKS } from "@/utils/constants";
import { ApiError, fail } from "@/utils/errors";
import { addDaysIso, formatDate } from "@/utils/formatDate";
import { validateDuration } from "@/utils/validators";
import { assertEligible, begin, setting, studentRef, studentUserId } from "./mockEngine";
import { can } from "@/utils/permissions";
import { audit, commit, db, matches, newId, notify, nowIso, out, requireAccount, requireCapability, requireStudent, sessionUserOf } from "./mockStore";

type BackendRow = Record<string, unknown>;

function backendRow(value: unknown): BackendRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("UNKNOWN", "The Server returned an invalid renewal response.");
  }
  return value as BackendRow;
}

function rowsFromResponse(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new ApiError("UNKNOWN", "The Server returned an invalid renewal list.");
  return value;
}

function renewalStatus(value: unknown): RenewalStatus {
  const normalized = typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "_") : "";
  if (normalized === "APPROVED" || normalized === "REJECTED" || normalized === "PENDING" || normalized === "CANCELLED") {
    return normalized;
  }
  throw new ApiError("UNKNOWN", `The Server returned an unsupported renewal status: ${String(value)}.`);
}

function requiredString(row: BackendRow, camel: string, snake: string, label: string): string {
  const value = row[camel] ?? row[snake];
  if (typeof value !== "string" && typeof value !== "number") {
    throw new ApiError("UNKNOWN", `The Server returned a renewal without ${label}.`);
  }
  return String(value);
}

function optionalDate(row: BackendRow, camel: string, snake: string): string | null {
  const value = row[camel] ?? row[snake];
  return value == null ? null : String(value);
}

function mapRenewal(value: unknown): RenewalView {
  const row = backendRow(value);
  const duration = Number(row.requestedDurationDays ?? row.requested_duration_days);
  if (!Number.isSafeInteger(duration) || duration < 1) {
    throw new ApiError("UNKNOWN", "The Server returned a renewal with an invalid requested duration.");
  }
  return {
    id: requiredString(row, "id", "renewal_id", "an ID"),
    loanId: requiredString(row, "loanId", "borrow_id", "a loan ID"),
    bookTitle: requiredString(row, "bookTitle", "book_title", "a book title"),
    requestedDurationDays: duration,
    status: renewalStatus(row.status ?? row.renewal_status),
    requestedAt: requiredString(row, "requestedAt", "requested_at", "a request date"),
    approvedAt: optionalDate(row, "approvedAt", "approved_at") ?? optionalDate(row, "approvedAt", "reviewed_at"),
    oldDueAt: optionalDate(row, "oldDueAt", "old_due_date"),
    newDueAt: optionalDate(row, "newDueAt", "new_due_date"),
    decisionReason: typeof (row.decisionReason ?? row.decision_reason ?? row.remarks) === "string"
      ? String(row.decisionReason ?? row.decision_reason ?? row.remarks)
      : null,
  };
}

function mapStaffRenewal(value: unknown): StaffRenewalView {
  const row = backendRow(value);
  const student = row.student && typeof row.student === "object" ? backendRow(row.student) : {};
  return {
    ...mapRenewal(row),
    student: {
      id: String(student.id ?? ""),
      studentNumber: String(student.studentNumber ?? student.student_number ?? ""),
      firstName: String(student.firstName ?? student.first_name ?? ""),
      lastName: String(student.lastName ?? student.last_name ?? ""),
    },
  };
}

function positiveIntegerId(value: UUID, label: string): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    fail("VALIDATION_ERROR", `${label} must be a positive integer.`, 400);
  }
  return Number(value);
}

const strip = (r: MockRenewal): RenewalView => {
  const { studentId: _studentId, ...view } = r;
  return view;
};

/** The Server automatically approves or rejects a renewal and returns that decision. */
export async function createRenewal(loanId: UUID, req: CreateRenewalRequest): Promise<RenewalView> {
  if (!USE_MOCKS) {
    const id = positiveIntegerId(loanId, "Loan id");
    const response = (await apiClient.post<unknown>(`/renewals/loan/${id}`, {
      requestedDurationDays: req.requestedDurationDays,
    })).data;
    return mapRenewal(response);
  }
  await begin();
  const { account, student } = requireStudent();
  const loan = db.loans.find((l) => l.id === loanId && l.studentId === student.id);
  if (!loan) fail("NOT_FOUND", "We could not find that loan.");
  if (loan.status !== "ACTIVE") fail("INVALID_STATE", "Only active loans can be renewed.", 409);
  const durationError = validateDuration(req.requestedDurationDays);
  if (durationError) fail("INVALID_DURATION", durationError, 422);
  assertEligible(student.id);
  if (loan.renewedCount >= setting("RENEWAL_LIMIT")) fail("RENEWAL_LIMIT_REACHED", undefined, 403);

  const now = nowIso();
  const base: MockRenewal = {
    id: newId(),
    studentId: student.id,
    loanId: loan.id,
    bookTitle: loan.bookTitle,
    requestedDurationDays: req.requestedDurationDays,
    status: "REJECTED",
    requestedAt: now,
    approvedAt: null,
    oldDueAt: null,
    newDueAt: null,
    decisionReason: null,
  };

  const queued = db.reservations.some((r) => r.bookId === loan.bookId && (r.status === "WAITING" || r.status === "OFFERED"));
  if (queued) {
    base.decisionReason = "Another student is waiting for this title.";
    db.renewals.unshift(base);
    notify(account.user.id, "RENEWAL_REJECTED", "Renewal not approved", `Your renewal for ${loan.bookTitle} was not approved: ${base.decisionReason}`, ["LOAN", loan.id]);
    commit();
    return out(strip(base));
  }

  base.status = "APPROVED";
  base.approvedAt = now;
  base.oldDueAt = loan.dueAt;
  base.newDueAt = addDaysIso(now, req.requestedDurationDays);
  loan.dueAt = base.newDueAt;
  loan.renewedCount += 1;
  db.renewals.unshift(base);
  notify(account.user.id, "RENEWAL_APPROVED", "Renewal approved", `Your renewal for ${loan.bookTitle} was approved. New due date: ${formatDate(base.newDueAt)}.`, ["LOAN", loan.id]);
  commit();
  return out(strip(base));
}

/** List the current student's renewal history. */
export async function listMyRenewals(): Promise<RenewalView[]> {
  if (!USE_MOCKS) {
    const response = (await apiClient.get<unknown>("/renewals/mine")).data;
    return rowsFromResponse(response).map(mapRenewal);
  }
  await begin();
  const { student } = requireStudent();
  return out(db.renewals.filter((r) => r.studentId === student.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).map(strip));
}

/** List renewal history for a loan owned by the student or accessible by staff. */
export async function listLoanRenewals(loanId: UUID): Promise<RenewalView[]> {
  if (!USE_MOCKS) {
    const id = positiveIntegerId(loanId, "Loan id");
    const response = (await apiClient.get<unknown>(`/renewals/loan/${id}`)).data;
    return rowsFromResponse(response).map(mapRenewal);
  }
  await begin();
  const account = requireAccount();
  const loan = db.loans.find((l) => l.id === loanId);
  const staff = can(sessionUserOf(account), "STAFF_AREA");
  if (!loan || (!staff && loan.studentId !== account.student?.id)) fail("NOT_FOUND", "We could not find that loan.");
  return out(db.renewals.filter((r) => r.loanId === loanId).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).map(strip));
}

/** List renewal history for staff, optionally filtered by the Server's search query. */
export async function listStaffRenewals(params: { search?: string } = {}): Promise<StaffRenewalView[]> {
  if (!USE_MOCKS) {
    const response = (await apiClient.get<unknown>("/renewals", {
      params: params.search?.trim() ? { search: params.search.trim() } : undefined,
    })).data;
    return rowsFromResponse(response).map(mapStaffRenewal);
  }
  await begin();
  const staff = requireCapability("STAFF_AREA");
  void staff;
  void audit;
  return out(
    db.renewals
      .map((r): StaffRenewalView => ({ ...strip(r), student: studentRef(r.studentId) }))
      .filter((r) => matches(params.search, r.bookTitle, r.student.firstName, r.student.lastName, r.student.studentNumber))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
  );
}

export { studentUserId as _studentUserId };
