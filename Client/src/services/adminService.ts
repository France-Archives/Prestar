import type {
  AcademicTerm,
  AdminUserListParams,
  AdminUserRow,
  AuditLog,
  AuditLogParams,
  CorSummary,
  CorVerification,
  CreateAcademicTermRequest,
  FineSummary,
  InviteLibrarianRequest,
  LibrarianAccount,
  Loan,
  NotificationItem,
  NotificationType,
  PageParams,
  Paginated,
  PenaltyCheck,
  Reservation,
  Setting,
  StaffFine,
  StudentProfile,
  UpdateAcademicTermRequest,
  UpdateLibrarianPermissionsRequest,
  UpdateSettingRequest,
  UpdateUserStatusRequest,
  UUID,
} from "@/types";
import { LIBRARIAN_PERMISSIONS } from "@/types";
import type { MockAccount } from "@/data";
import { POLICY_SETTINGS } from "@/utils/constants";
import { fail } from "@/utils/errors";
import { dateKey } from "@/utils/formatDate";
import { validateDateRange, validateEmail, validateName, validateRequired } from "@/utils/validators";
import { begin, checkEligibility, corSummaryOf, toCor, toFineSummary, toLoan, toReservation, toStaffFine } from "./mockEngine";
import { audit, commit, db, issueToken, matches, newId, notify, nowIso, out, paginate, requireCapability } from "./mockStore";

// TEMPORARY MOCK IMPLEMENTATION: Replace with the real admin API (A9, D5 to D12, P15).
// Admin can ALSO run every Librarian operation (staff services accept ADMIN); this file holds the Admin-only tools.
// The announcement/notification management functions have NO endpoint in the source: mock only, TO CONFIRM.

const check = (message: string | null): void => {
  if (message) fail("VALIDATION_ERROR", message, 422);
};

function toUserRow(a: MockAccount): AdminUserRow {
  return {
    id: a.user.id,
    email: a.user.email,
    role: a.user.role,
    accountStatus: a.user.accountStatus,
    emailVerifiedAt: a.user.emailVerifiedAt,
    displayName: a.displayName,
    studentId: a.student?.id ?? null,
    studentNumber: a.student?.studentNumber ?? null,
    employeeNumber: a.librarian?.employeeNumber ?? null,
    createdAt: a.createdAt,
  };
}

const toLibrarianAccount = (a: MockAccount): LibrarianAccount => ({
  userId: a.user.id,
  email: a.user.email,
  displayName: a.displayName,
  employeeNumber: a.librarian?.employeeNumber ?? null,
  accountStatus: a.user.accountStatus,
  permissions: a.librarian?.permissions ?? [],
  invitation: a.invitation ?? "ACCEPTED",
  createdAt: a.createdAt,
});

// ---------- users ----------

/** D5 GET /admin/users */
export async function listUsers(params: AdminUserListParams = {}): Promise<Paginated<AdminUserRow>> {
  await begin();
  requireCapability("ADMIN_AREA");
  const rows = db.accounts
    .filter((a) => !params.role || a.user.role === params.role)
    .filter((a) => !params.accountStatus || a.user.accountStatus === params.accountStatus)
    .filter((a) => matches(params.search, a.displayName, a.user.email, a.student?.studentNumber, a.librarian?.employeeNumber))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map(toUserRow);
  return out(paginate(rows, params.page, params.pageSize));
}

export interface AdminStudentDetails {
  user: AdminUserRow;
  profile: StudentProfile;
  cor: CorSummary;
  verifications: CorVerification[];
  loans: Loan[];
  reservations: Reservation[];
  fines: StaffFine[];
  penaltyCheck: PenaltyCheck;
}

/** Composed view for the student details page (profile + COR + loans + fines + live penalty check). */
export async function getStudentDetails(studentId: UUID): Promise<AdminStudentDetails> {
  await begin();
  requireCapability("ADMIN_AREA");
  const account = db.accounts.find((a) => a.student?.id === studentId);
  if (!account || !account.student) fail("NOT_FOUND", "We could not find that student.");
  return out({
    user: toUserRow(account),
    profile: account.student,
    cor: corSummaryOf(studentId),
    verifications: db.cors.filter((c) => c.studentId === studentId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map(toCor),
    loans: db.loans.filter((l) => l.studentId === studentId).sort((a, b) => b.borrowedAt.localeCompare(a.borrowedAt)).map(toLoan),
    reservations: db.reservations.filter((r) => r.studentId === studentId).sort((a, b) => b.reservedAt.localeCompare(a.reservedAt)).map(toReservation),
    fines: db.fines.filter((f) => f.studentId === studentId).map(toStaffFine),
    penaltyCheck: checkEligibility(studentId),
  });
}

/** D6 PATCH /admin/users/:userId/status. Reason required. Existing loans and due dates are unchanged. */
export async function updateUserStatus(userId: UUID, req: UpdateUserStatusRequest): Promise<AdminUserRow> {
  await begin();
  const admin = requireCapability("ADMIN_AREA");
  check(validateRequired(req.reason, "A reason"));
  if (req.status !== "ACTIVE" && req.status !== "SUSPENDED" && req.status !== "DISABLED") fail("VALIDATION_ERROR", "Choose Active, Suspended or Disabled.", 422);
  const target = db.accounts.find((a) => a.user.id === userId);
  if (!target) fail("NOT_FOUND", "We could not find that user.");
  if (target.user.id === admin.user.id) fail("FORBIDDEN", "You cannot change the status of your own account.", 403);
  const was = target.user.accountStatus;
  // Reactivating an unverified account returns it to PENDING_VERIFICATION. Reversal of DISABLED is TO CONFIRM.
  const next = req.status === "ACTIVE" && !target.user.emailVerifiedAt ? "PENDING_VERIFICATION" : req.status;
  if (was === next) fail("INVALID_STATE", "The account already has this status.", 409);
  target.user.accountStatus = next;
  if (next === "SUSPENDED") notify(userId, "ACCOUNT_SUSPENDED", "Account suspended", `Your account is suspended: ${req.reason.trim()}. You cannot start new borrowing until it is reactivated.`, ["USER", userId]);
  if (was === "SUSPENDED" && next === "ACTIVE") notify(userId, "ACCOUNT_REACTIVATED", "Account reactivated", "Your account was reactivated. Other restrictions may still apply.", ["USER", userId]);
  audit(admin, "USER_STATUS_CHANGED", "USER", userId, `Changed ${target.displayName} from ${was} to ${next}: ${req.reason.trim()}`);
  commit();
  return out(toUserRow(target));
}

// ---------- librarians ----------

/** Admin list of Librarian accounts (derived from D5 + P15). */
export async function listLibrarians(): Promise<LibrarianAccount[]> {
  await begin();
  requireCapability("MANAGE_LIBRARIANS");
  return out(db.accounts.filter((a) => a.user.role === "LIBRARIAN").map(toLibrarianAccount).sort((a, b) => a.displayName.localeCompare(b.displayName)));
}

/** A9 POST /admin/librarians/invitations. MOCK ONLY: the token is returned; a real backend emails the link (P2). */
export async function inviteLibrarian(req: InviteLibrarianRequest): Promise<{ librarian: LibrarianAccount; mockInvitationToken: string }> {
  await begin();
  const admin = requireCapability("MANAGE_LIBRARIANS");
  check(validateEmail(req.email));
  check(validateName(req.firstName, "First name"));
  check(validateName(req.lastName, "Last name"));
  const email = req.email.trim().toLowerCase();
  if (db.accounts.some((a) => a.user.email.toLowerCase() === email)) fail("CONFLICT", "An account already exists for this email.");
  const permissions = (req.permissions ?? []).filter((p) => LIBRARIAN_PERMISSIONS.includes(p));
  const userId = newId();
  const account: MockAccount = {
    user: { id: userId, email, role: "LIBRARIAN", accountStatus: "PENDING_VERIFICATION", emailVerifiedAt: null },
    password: "",
    displayName: `${req.firstName.trim()} ${req.lastName.trim()}`,
    student: null,
    librarian: { id: newId(), userId, employeeNumber: req.employeeNumber?.trim() || null, permissions },
    createdAt: nowIso(),
    invitation: "PENDING",
  };
  db.accounts.push(account);
  const mockInvitationToken = issueToken(userId, "INVITATION", 72);
  audit(admin, "LIBRARIAN_INVITED", "USER", userId, `Invited ${account.displayName} (${email}) as a Librarian.`);
  commit();
  return out({ librarian: toLibrarianAccount(account), mockInvitationToken });
}

/** P15 PUT /admin/librarians/:userId/permissions (proposed). Key names and storage are TO CONFIRM (TC-08). */
export async function updateLibrarianPermissions(userId: UUID, req: UpdateLibrarianPermissionsRequest): Promise<LibrarianAccount> {
  await begin();
  const admin = requireCapability("MANAGE_LIBRARIANS");
  const target = db.accounts.find((a) => a.user.id === userId && a.librarian);
  if (!target || !target.librarian) fail("NOT_FOUND", "We could not find that Librarian.");
  if (!req.permissions.every((p) => LIBRARIAN_PERMISSIONS.includes(p))) fail("VALIDATION_ERROR", "Unknown permission.", 422);
  target.librarian.permissions = [...new Set(req.permissions)];
  audit(admin, "LIBRARIAN_PERMISSIONS_CHANGED", "USER", userId, `Set the permissions of ${target.displayName} to: ${target.librarian.permissions.join(", ") || "none"}.`);
  commit();
  return out(toLibrarianAccount(target));
}

// ---------- academic terms ----------

function validateTerm(req: Partial<CreateAcademicTermRequest>, selfId?: UUID): void {
  if (req.name !== undefined) check(validateRequired(req.name, "Term name", 150));
  if (req.startDate && req.endDate) check(validateDateRange(req.startDate, req.endDate));
  if (req.endDate && req.corDeadline && req.corDeadline > req.endDate) fail("VALIDATION_ERROR", "The COR deadline cannot be after the end date.", 422);
  if (req.status === "ACTIVE" && db.terms.some((t) => t.status === "ACTIVE" && t.id !== selfId)) {
    fail("CONFLICT", "Another term is already active. Mark it completed first. (Overlap rules are TO CONFIRM, TC-05.)");
  }
}

/** D9 GET /admin/academic-terms. Oldest term first. */
export async function listAcademicTerms(): Promise<AcademicTerm[]> {
  await begin();
  requireCapability("ADMIN_AREA");
  return out([...db.terms].sort((a, b) => a.startDate.localeCompare(b.startDate)));
}

/** D10 POST /admin/academic-terms */
export async function createAcademicTerm(req: CreateAcademicTermRequest): Promise<AcademicTerm> {
  await begin();
  const admin = requireCapability("ADMIN_AREA");
  if (!req.name || !req.startDate || !req.endDate || !req.corDeadline) fail("VALIDATION_ERROR", "Name, start date, end date and COR deadline are required.", 422);
  validateTerm(req);
  const term: AcademicTerm = { id: newId(), name: req.name.trim(), startDate: req.startDate, endDate: req.endDate, corDeadline: req.corDeadline, status: req.status ?? "UPCOMING" };
  db.terms.push(term);
  audit(admin, "TERM_CREATED", "ACADEMIC_TERM", term.id, `Created the academic term ${term.name}.`);
  commit();
  return out(term);
}

/** D11 PATCH /admin/academic-terms/:id */
export async function updateAcademicTerm(id: UUID, req: UpdateAcademicTermRequest): Promise<AcademicTerm> {
  await begin();
  const admin = requireCapability("ADMIN_AREA");
  const term = db.terms.find((t) => t.id === id);
  if (!term) fail("NOT_FOUND", "We could not find that academic term.");
  const merged = { ...term, ...req };
  validateTerm({ name: merged.name, startDate: merged.startDate, endDate: merged.endDate, corDeadline: merged.corDeadline, status: merged.status }, id);
  Object.assign(term, { name: merged.name.trim(), startDate: merged.startDate, endDate: merged.endDate, corDeadline: merged.corDeadline, status: merged.status });
  audit(admin, "TERM_UPDATED", "ACADEMIC_TERM", term.id, `Updated the academic term ${term.name}.`);
  commit();
  return out(term);
}

// ---------- settings ----------

/** D7 GET /admin/settings */
export async function listSettings(): Promise<Setting[]> {
  await begin();
  requireCapability("ADMIN_AREA");
  return out(db.settings);
}

/** D8 PATCH /admin/settings/:key. Changes take effect immediately in the mock engine. */
export async function updateSetting(key: string, req: UpdateSettingRequest): Promise<Setting> {
  await begin();
  const admin = requireCapability("ADMIN_AREA");
  const setting = db.settings.find((s) => s.key === key);
  if (!setting) fail("NOT_FOUND", "We could not find that setting.");
  const meta = POLICY_SETTINGS.find((p) => p.key === key);
  if (setting.valueType === "NUMBER") {
    const n = Number(req.value);
    if (!Number.isInteger(n)) fail("VALIDATION_ERROR", "Enter a whole number.", 422);
    if (meta && (n < meta.min || n > meta.max)) fail("VALIDATION_ERROR", `Enter a value from ${meta.min} to ${meta.max}.`, 422);
    setting.value = n;
  } else if (typeof req.value !== typeof setting.value) {
    fail("VALIDATION_ERROR", "The value has the wrong type for this setting.", 422);
  } else {
    setting.value = req.value;
  }
  setting.updatedAt = nowIso();
  audit(admin, "SETTING_UPDATED", "SETTING", null, `Changed ${key} to ${String(setting.value)}.`);
  commit();
  return out(setting);
}

// ---------- audit logs ----------

/** D12 GET /admin/audit-logs */
export async function listAuditLogs(params: AuditLogParams = {}): Promise<Paginated<AuditLog>> {
  await begin();
  requireCapability("ADMIN_AREA");
  const rows = db.audit
    .filter((l) => !params.actorRole || l.actorRole === params.actorRole)
    .filter((l) => !params.action || l.action === params.action)
    .filter((l) => !params.from || dateKey(l.createdAt) >= params.from)
    .filter((l) => !params.to || dateKey(l.createdAt) <= params.to)
    .filter((l) => matches(params.search, l.summary, l.actorName, l.action))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out(paginate(rows, params.page, params.pageSize));
}

// ---------- notifications management (mock only, TO CONFIRM) ----------

export interface AdminNotificationRow extends NotificationItem {
  recipientName: string;
}

export async function listAllNotifications(params: PageParams & { type?: NotificationType; search?: string } = {}): Promise<Paginated<AdminNotificationRow>> {
  await begin();
  requireCapability("ADMIN_AREA");
  const rows = db.notifications
    .filter((n) => !params.type || n.type === params.type)
    .map((n): AdminNotificationRow => {
      const { userId, ...item } = n;
      return { ...item, recipientName: db.accounts.find((a) => a.user.id === userId)?.displayName ?? "Unknown" };
    })
    .filter((n) => matches(params.search, n.title, n.message, n.recipientName))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out(paginate(rows, params.page, params.pageSize));
}

export type BroadcastAudience = "ALL_STUDENTS" | "ALL_STAFF" | "EVERYONE";

/** Sends an in-app GENERAL notice. The real notification matrix has no announcement trigger yet (TO CONFIRM). */
export async function broadcastNotification(req: { audience: BroadcastAudience; title: string; message: string }): Promise<{ recipients: number }> {
  await begin();
  const admin = requireCapability("ADMIN_AREA");
  check(validateRequired(req.title, "Title", 200));
  check(validateRequired(req.message, "Message"));
  const recipients = db.accounts.filter((a) => {
    if (a.user.accountStatus === "DISABLED") return false;
    if (req.audience === "ALL_STUDENTS") return a.user.role === "STUDENT";
    if (req.audience === "ALL_STAFF") return a.user.role !== "STUDENT";
    return true;
  });
  recipients.forEach((a) => notify(a.user.id, "GENERAL", req.title.trim(), req.message.trim(), null));
  audit(admin, "NOTICE_BROADCAST", "NOTIFICATION", null, `Sent the notice "${req.title.trim()}" to ${recipients.length} recipients.`);
  commit();
  return { recipients: recipients.length };
}

export type { FineSummary };
export { toFineSummary as _toFineSummary };