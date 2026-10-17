import type { AllowedDurationDays, FineType, ErrorCode, UserRole } from "@/types";
import { ALLOWED_DURATION_DAYS } from "@/types";

// ---------- Environment ----------
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
// Mocks stay ON until the backend exists. Set VITE_USE_MOCKS=false to switch services to Axios.
export const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS !== "false";

export const TIME_ZONE = "Asia/Manila";
export const DEFAULT_PAGE_SIZE = 20;

// ---------- Business limits (Project Agreements §7) ----------
// DISPLAY / DEMO ONLY. The backend is authoritative. In production these come from system_settings.
export const LIMITS = {
  MAX_ACTIVE_COMMITMENTS: 10,
  MAX_ACTIVE_SAME_TITLE: 2,
  PICKUP_HOLD_DAYS: 3,
  RESERVATION_HOLD_DAYS: 3,
  OVERDUE_GRACE_DAYS: 3,
  RENEWAL_LIMIT: 1, // TO CONFIRM as final (TC-07)
  DUE_SOON_DAYS: 2,
  INTEREST_COUNT: 3,
} as const;

// Fines are fixed amounts. No daily overdue fine. Waiver workflow TO CONFIRM (TC-15).
export const FINE_AMOUNTS: Record<FineType, number> = {
  DAMAGE_MINOR: 100,
  DAMAGE_MAJOR: 200,
  LOST_BOOK: 500,
};

export const DURATION_OPTIONS: readonly AllowedDurationDays[] = ALLOWED_DURATION_DAYS;
/** Alias used by the borrowing policy screen. */
export const ALLOWED_DURATIONS: readonly AllowedDurationDays[] = ALLOWED_DURATION_DAYS;
export const durationLabel = (days: number) => `${days} days`;

// COR upload limits. Baseline values; formats and size are TO CONFIRM (TC-04).
export const COR_UPLOAD = {
  MAX_BYTES: 5 * 1024 * 1024,
  ALLOWED_MIME: ["application/pdf", "image/jpeg", "image/png"],
  ALLOWED_EXTENSIONS: [".pdf", ".jpg", ".jpeg", ".png"],
} as const;

// Password policy. Baseline; final policy is TO CONFIRM (TC-03).
export const PASSWORD_POLICY = { MIN_LENGTH: 8 } as const;

// ---------- Reason options for staff handover actions (Business Rules §2.4) ----------
// Reason codes are free-form strings in the contract (reasonCode: string). These are the UI choices.
export const HOLD_REASONS = [
  { code: "UNPAID_FINE", label: "Unpaid fine to settle" },
  { code: "OVERDUE_LOAN", label: "Overdue loan to resolve" },
  { code: "COR_ISSUE", label: "COR issue to resolve" },
  { code: "OTHER", label: "Other resolvable issue" },
] as const;

export const REJECT_REASONS = [
  { code: "COPY_MISMATCH", label: "Copy barcode does not match" },
  { code: "COPY_DAMAGED", label: "Assigned copy is damaged" },
  { code: "IDENTITY_UNVERIFIED", label: "Student identity not verified" },
  { code: "DATA_INCONSISTENT", label: "Record data is inconsistent" },
  { code: "OTHER", label: "Other reason" },
] as const;

// ---------- Admin-editable policy settings (system_settings keys, Integration PDF §5) ----------
export interface PolicySettingMeta {
  key: string;
  label: string;
  description: string;
  min: number;
  max: number;
  defaultValue: number;
}
export const POLICY_SETTINGS: PolicySettingMeta[] = [
  { key: "MAX_ACTIVE_COMMITMENTS", label: "Max active commitments per student", description: "Active loans + approved pickups + active reservations.", min: 1, max: 50, defaultValue: LIMITS.MAX_ACTIVE_COMMITMENTS },
  { key: "MAX_ACTIVE_SAME_TITLE", label: "Max active commitments for the same title", description: "Requests, loans and reservations of one title.", min: 1, max: 10, defaultValue: LIMITS.MAX_ACTIVE_SAME_TITLE },
  { key: "PICKUP_HOLD_DAYS", label: "Pickup deadline (calendar days)", description: "Days an approved request is held for pickup.", min: 1, max: 14, defaultValue: LIMITS.PICKUP_HOLD_DAYS },
  { key: "RESERVATION_HOLD_DAYS", label: "Reservation offer deadline (calendar days)", description: "Days an offered copy is held for the next student.", min: 1, max: 14, defaultValue: LIMITS.RESERVATION_HOLD_DAYS },
  { key: "OVERDUE_GRACE_DAYS", label: "Overdue grace period (calendar days)", description: "Borrowing is restricted only when MORE than this many days overdue.", min: 0, max: 14, defaultValue: LIMITS.OVERDUE_GRACE_DAYS },
  { key: "RENEWAL_LIMIT", label: "Renewals per loan", description: "Baseline is 1 (TO CONFIRM).", min: 0, max: 5, defaultValue: LIMITS.RENEWAL_LIMIT },
  { key: "DUE_SOON_DAYS", label: "Due-soon reminder (days before due)", description: "When the due-soon reminder is sent.", min: 1, max: 14, defaultValue: LIMITS.DUE_SOON_DAYS },
];

// ---------- Routes ----------
// These MUST match src/app/routeConfig.ts and src/app/router.tsx (the router is the source of truth).
// Students live under /app, staff (Librarian + Admin) under /staff, Admin-only under /admin.
export const ROUTES = {
  public: {
    home: "/",
    login: "/login",
    signup: "/signup",
    verifyEmail: "/verify-email",
    verificationPending: "/verification-pending",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
    acceptInvitation: "/accept-invitation", // P2
    contact: "/contact",
    terms: "/terms",
    privacy: "/privacy",
  },
  student: {
    dashboard: "/app/dashboard",
    books: "/app/books",
    bookDetails: "/app/books/:bookId",
    interests: "/app/interests",
    borrowings: "/app/borrowing",
    requests: "/app/requests",
    reservations: "/app/reservations",
    renewals: "/app/renewals",
    history: "/app/history",
    profile: "/app/profile",
    cor: "/app/cor",
    uploadCor: "/app/cor/upload",
    notifications: "/app/notifications",
  },
  staff: {
    dashboard: "/staff/dashboard",
    books: "/staff/books",
    bookCopies: "/staff/books/:bookId/copies",
    categories: "/staff/categories",
    authors: "/staff/authors",
    requests: "/staff/requests",
    release: "/staff/books-to-release",
    handover: "/staff/handover/:requestId",
    returns: "/staff/returns",
    reservations: "/staff/reservations",
    renewals: "/staff/renewals",
    corReview: "/staff/cor-review",
    penaltyCheck: "/staff/penalty-check",
    fines: "/staff/fines",
    payments: "/staff/payments",
    maintenance: "/staff/maintenance",
    notifications: "/staff/notifications",
  },
  admin: {
    dashboard: "/admin/dashboard",
    users: "/admin/users",
    studentDetails: "/admin/users/students/:studentId",
    librarians: "/admin/librarians",
    books: "/admin/books",
    circulation: "/admin/circulation",
    cor: "/admin/cor",
    terms: "/admin/terms",
    settings: "/admin/settings",
    policies: "/admin/policies",
    fines: "/admin/fines",
    reports: "/admin/reports",
    auditLogs: "/admin/audit-logs",
    notifications: "/admin/notifications",
  },
} as const;

/** Builders for the routes that take a parameter. */
export const path = {
  studentBook: (bookId: string) => `/app/books/${bookId}`,
  staffBookCopies: (bookId: string) => `/staff/books/${bookId}/copies`,
  staffHandover: (requestId: string) => `/staff/handover/${requestId}`,
  adminStudent: (studentId: string) => `/admin/users/students/${studentId}`,
};

export const HOME_BY_ROLE: Record<UserRole, string> = {
  STUDENT: ROUTES.student.dashboard,
  LIBRARIAN: ROUTES.staff.dashboard,
  ADMIN: ROUTES.admin.dashboard,
};

// Admin reads its own feed on the shared staff notifications page (same as notificationsPathFor in routeConfig).
// /admin/notifications is the notification MANAGEMENT screen, not the personal feed.
export const NOTIFICATIONS_BY_ROLE: Record<UserRole, string> = {
  STUDENT: ROUTES.student.notifications,
  LIBRARIAN: ROUTES.staff.notifications,
  ADMIN: ROUTES.staff.notifications,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: "Student",
  LIBRARIAN: "Librarian",
  ADMIN: "Admin",
};

// ---------- Status display (labels and badge tones) ----------
export type Tone = "ok" | "info" | "warn" | "danger" | "neutral";

const STATUS_TONE: Record<string, Tone> = {
  // account / term
  ACTIVE: "ok",
  SUSPENDED: "danger",
  PENDING_VERIFICATION: "warn",
  DISABLED: "neutral",
  UPCOMING: "info",
  COMPLETED: "neutral",
  // COR
  PENDING: "warn",
  APPROVED: "ok",
  REJECTED: "danger",
  SUPERSEDED: "neutral",
  MISSING: "warn",
  EXPIRED: "neutral",
  NOT_YET_EFFECTIVE: "info",
  // copies
  AVAILABLE: "ok",
  RESERVED: "info",
  ON_LOAN: "info",
  MAINTENANCE: "warn",
  LOST: "danger",
  WITHDRAWN: "neutral",
  // condition
  NEW: "ok",
  GOOD: "ok",
  FAIR: "warn",
  DAMAGED: "warn",
  UNUSABLE: "danger",
  // requests / loans / reservations
  ON_HOLD: "warn",
  RELEASE_REJECTED: "danger",
  CLAIMED: "ok",
  CANCELLED: "neutral",
  RETURNED: "ok",
  WAITING: "info",
  OFFERED: "warn",
  COLLECTED: "ok",
  // fines
  UNPAID: "danger",
  PARTIALLY_PAID: "warn",
  PAID: "ok",
  WAIVED: "neutral",
  // handover attempts
  CHECKED: "info",
  PLACED_ON_HOLD: "warn",
  // derived display values (never stored)
  OVERDUE: "danger",
  DUE_SOON: "warn",
  // roles
  STUDENT: "neutral",
  LIBRARIAN: "info",
  ADMIN: "ok",
};

const STATUS_LABEL: Record<string, string> = {
  DAMAGE_MINOR: "Minor damage",
  DAMAGE_MAJOR: "Major damage",
  LOST_BOOK: "Lost book",
  OTHER_IN_PERSON: "Other (in person)",
  COR_REVIEW: "COR review",
  CATALOG_MANAGE: "Catalog management",
  FINE_PAYMENT: "Fines and payments",
  DUE_SOON: "Due soon",
};

const humanize = (value: string) => {
  const s = value.toLowerCase().replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const statusLabel = (value: string): string => STATUS_LABEL[value] ?? humanize(value);
export const statusTone = (value: string): Tone => STATUS_TONE[value] ?? "neutral";

// ---------- Error codes that deserve a call-to-action ----------
export const ERROR_ACTIONS: Partial<Record<ErrorCode, { label: string; to: string }>> = {
  COR_REQUIRED: { label: "Submit your COR", to: ROUTES.student.uploadCor },
  COR_EXPIRED: { label: "Submit your COR", to: ROUTES.student.uploadCor },
  COR_NOT_YET_EFFECTIVE: { label: "View COR status", to: ROUTES.student.cor },
  EMAIL_NOT_VERIFIED: { label: "Verify your email", to: ROUTES.public.verificationPending },
  UNAUTHENTICATED: { label: "Log in", to: ROUTES.public.login },
};

// Shown wherever an action is only simulated.
export const MOCK_NOTICE = "Simulated: no real backend is connected yet.";