import type {
  AcademicTerm,
  AuditLog,
  AuthorSummary,
  BookCopy,
  CategorySummary,
  HandoverAttempt,
  Interest,
  MockEmailToken,
  NotificationType,
  Paginated,
  RelatedEntityType,
  SessionUser,
  Setting,
  StudentProfile,
  UUID,
} from "@/types";
import type {
  MockAccount,
  MockBook,
  MockBorrowingRequest,
  MockCorRecord,
  MockFine,
  MockLoan,
  MockNotification,
  MockPayment,
  MockRenewal,
  MockReservation,
} from "@/data";
import {
  MOCK_ACADEMIC_TERMS,
  MOCK_ACCOUNTS,
  MOCK_AUTHORS,
  MOCK_BOOKS,
  MOCK_BORROWING_REQUESTS,
  MOCK_CATEGORIES,
  MOCK_COPIES,
  MOCK_COR_RECORDS,
  MOCK_EMAIL_TOKENS,
  MOCK_FINES,
  MOCK_HANDOVER_ATTEMPTS,
  MOCK_INTERESTS,
  MOCK_LOANS,
  MOCK_NOTIFICATIONS,
  MOCK_PAYMENTS,
  MOCK_RENEWALS,
  MOCK_RESERVATIONS,
  MOCK_STUDENT_INTERESTS,
  USER_ID,
  at,
  uid,
} from "@/data";
import { DEFAULT_PAGE_SIZE, POLICY_SETTINGS } from "@/utils/constants";
import { fail } from "@/utils/errors";
import { addDaysIso } from "@/utils/formatDate";
import { can, type Capability } from "@/utils/permissions";

// TEMPORARY MOCK IMPLEMENTATION: an in-memory "database" plus session, notifications and audit helpers.
// Everything here simulates backend behaviour (authentication, authorization, persistence, outbox, audit).
// REPLACE: delete this file and mockEngine.ts when every service calls the real API.
// State lives in memory only: a page refresh resets the demo data. Only the demo login survives (sessionStorage).

export interface MockDb {
  accounts: MockAccount[];
  books: MockBook[];
  categories: CategorySummary[];
  authors: AuthorSummary[];
  copies: BookCopy[];
  requests: MockBorrowingRequest[];
  loans: MockLoan[];
  attempts: HandoverAttempt[];
  reservations: MockReservation[];
  renewals: MockRenewal[];
  cors: MockCorRecord[];
  fines: MockFine[];
  payments: MockPayment[];
  notifications: MockNotification[];
  interests: Interest[];
  studentInterests: Record<UUID, UUID[]>;
  terms: AcademicTerm[];
  tokens: MockEmailToken[];
  settings: Setting[];
  audit: AuditLog[];
}

const seedSettings = (): Setting[] =>
  POLICY_SETTINGS.map((p) => ({
    key: p.key,
    value: p.defaultValue,
    valueType: "NUMBER",
    description: p.description,
    updatedAt: at(-90),
  }));

const AUDIT_NS = 19; // audit ids are not part of the shared namespaces
const seedAudit = (): AuditLog[] => [
  { id: uid(AUDIT_NS, 1), actorUserId: USER_ID.leo, actorName: "Leo Cruz", actorRole: "LIBRARIAN", action: "HANDOVER_CLAIMED", entityType: "BORROWING_REQUEST", entityId: null, summary: "Confirmed handover of Atomic Habits to Ana Reyes.", createdAt: at(-5) },
  { id: uid(AUDIT_NS, 2), actorUserId: USER_ID.leo, actorName: "Leo Cruz", actorRole: "LIBRARIAN", action: "COR_APPROVED", entityType: "STUDENT_VERIFICATION", entityId: null, summary: "Approved the COR of Carla Diaz for AY 2026-2027 · 1st Semester.", createdAt: at(-63) },
  { id: uid(AUDIT_NS, 3), actorUserId: USER_ID.admin, actorName: "Mia Santos", actorRole: "ADMIN", action: "FINE_WAIVED", entityType: "FINE", entityId: null, summary: "Waived a ₱100.00 minor damage fine for Ana Reyes: the damage was already present.", createdAt: at(-34) },
];

export const db: MockDb = {
  accounts: structuredClone(MOCK_ACCOUNTS),
  books: structuredClone(MOCK_BOOKS),
  categories: structuredClone(MOCK_CATEGORIES),
  authors: structuredClone(MOCK_AUTHORS),
  copies: structuredClone(MOCK_COPIES),
  requests: structuredClone(MOCK_BORROWING_REQUESTS),
  loans: structuredClone(MOCK_LOANS),
  attempts: structuredClone(MOCK_HANDOVER_ATTEMPTS),
  reservations: structuredClone(MOCK_RESERVATIONS),
  renewals: structuredClone(MOCK_RENEWALS),
  cors: structuredClone(MOCK_COR_RECORDS),
  fines: structuredClone(MOCK_FINES),
  payments: structuredClone(MOCK_PAYMENTS),
  notifications: structuredClone(MOCK_NOTIFICATIONS),
  interests: structuredClone(MOCK_INTERESTS),
  studentInterests: structuredClone(MOCK_STUDENT_INTERESTS),
  terms: structuredClone(MOCK_ACADEMIC_TERMS),
  tokens: structuredClone(MOCK_EMAIL_TOKENS),
  settings: seedSettings(),
  audit: seedAudit(),
};

// ---------- plumbing ----------
export const newId = (): UUID => crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();
export const latency = (ms = 220): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
/** Services return copies so callers can never mutate the store by accident. */
export const out = <T>(value: T): T => structuredClone(value);

const listeners = new Set<() => void>();
export function subscribeStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
/** Call after every mutation so contexts (e.g. the notification bell) can refresh. */
export const commit = (): void => listeners.forEach((fn) => fn());

export function paginate<T>(rows: T[], page = 1, pageSize = DEFAULT_PAGE_SIZE): Paginated<T> {
  const size = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const p = Math.max(1, Math.floor(page));
  return { data: rows.slice((p - 1) * size, p * size), meta: { page: p, pageSize: size, total: rows.length } };
}

/** True when the search term is empty or appears in any field (case-insensitive). */
export function matches(term: string | undefined, ...fields: (string | null | undefined)[]): boolean {
  const t = term?.trim().toLowerCase();
  return !t || fields.some((f) => f?.toLowerCase().includes(t));
}

// ---------- session (MOCK AUTH: a real backend keeps a cookie session or token) ----------
const SESSION_KEY = "prestar_mock_session_v1";

export function getSessionUserId(): UUID | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
export function setSessionUserId(id: UUID | null): void {
  try {
    if (id) sessionStorage.setItem(SESSION_KEY, id);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable: the session just will not survive a refresh */
  }
}

export const accountById = (userId: UUID): MockAccount | undefined => db.accounts.find((a) => a.user.id === userId);
export const accountByEmail = (email: string): MockAccount | undefined =>
  db.accounts.find((a) => a.user.email.toLowerCase() === email.trim().toLowerCase());
export const accountByStudentId = (studentId: UUID): MockAccount | undefined => db.accounts.find((a) => a.student?.id === studentId);

export function sessionUserOf(a: MockAccount): SessionUser {
  return { ...a.user, displayName: a.displayName, student: a.student, librarian: a.librarian };
}

export function requireAccount(): MockAccount {
  const id = getSessionUserId();
  const account = id ? accountById(id) : undefined;
  if (!account || account.user.accountStatus === "DISABLED") fail("UNAUTHENTICATED");
  return account;
}

/** Role/permission check. Admin passes every staff capability (Admin = Librarian + Admin-only). */
export function requireCapability(capability: Capability): MockAccount {
  const account = requireAccount();
  if (!can(sessionUserOf(account), capability)) fail("FORBIDDEN");
  return account;
}

export function requireStudent(): { account: MockAccount; student: StudentProfile } {
  const account = requireCapability("STUDENT_AREA");
  if (!account.student) fail("FORBIDDEN");
  return { account, student: account.student };
}

// ---------- email tokens (MOCK: a real backend stores only a SHA-256 hash and emails the raw token) ----------
export function issueToken(userId: UUID, purpose: MockEmailToken["purpose"], hours: number): string {
  db.tokens.forEach((t) => {
    if (t.userId === userId && t.purpose === purpose && !t.usedAt) t.usedAt = nowIso(); // older unused tokens are invalidated
  });
  const token = `mock-${newId()}`;
  db.tokens.push({ token, userId, purpose, expiresAt: addDaysIso(new Date(), hours / 24), usedAt: null });
  return token;
}

export function consumeToken(token: string, purpose: MockEmailToken["purpose"]): MockEmailToken {
  const t = db.tokens.find((x) => x.token === token && x.purpose === purpose);
  if (!t || t.usedAt || new Date(t.expiresAt).getTime() < Date.now()) fail("TOKEN_INVALID_OR_EXPIRED");
  t.usedAt = nowIso();
  return t;
}

// ---------- notifications and audit (the backend writes these after the transaction commits) ----------
export function notify(
  userId: UUID,
  type: NotificationType,
  title: string,
  message: string,
  related: [RelatedEntityType, UUID] | null = null,
): void {
  db.notifications.unshift({
    id: newId(),
    userId,
    type,
    title,
    message,
    relatedEntityType: related ? related[0] : null,
    relatedEntityId: related ? related[1] : null,
    readAt: null,
    createdAt: nowIso(),
  });
}

/** Admin and Librarians with COR_REVIEW are notified of new CORs. */
export function notifyCorReviewers(verificationId: UUID): void {
  for (const a of db.accounts) {
    const reviewer = a.user.role === "ADMIN" || (a.user.role === "LIBRARIAN" && a.librarian?.permissions.includes("COR_REVIEW"));
    if (reviewer && a.user.accountStatus === "ACTIVE") {
      notify(a.user.id, "COR_SUBMITTED", "COR awaiting review", "A student COR submission is waiting for review.", ["STUDENT_VERIFICATION", verificationId]);
    }
  }
}

export function audit(actor: MockAccount, action: string, entityType: string, entityId: UUID | null, summary: string): void {
  db.audit.unshift({
    id: newId(),
    actorUserId: actor.user.id,
    actorName: actor.displayName,
    actorRole: actor.user.role,
    action,
    entityType,
    entityId,
    summary,
    createdAt: nowIso(),
  });
}