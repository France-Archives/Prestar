// Exact enum values. Identical in DB, API and TypeScript (Project Agreements §5).
// Do not add ad-hoc strings anywhere else in the app.

export const USER_ROLES = ["STUDENT", "LIBRARIAN", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACCOUNT_STATUSES = ["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION", "DISABLED"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const TERM_STATUSES = ["UPCOMING", "ACTIVE", "COMPLETED"] as const;
export type TermStatus = (typeof TERM_STATUSES)[number];

export const VERIFICATION_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUPERSEDED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const BOOK_COPY_STATUSES = ["AVAILABLE", "RESERVED", "ON_LOAN", "MAINTENANCE", "LOST", "WITHDRAWN"] as const;
export type BookCopyStatus = (typeof BOOK_COPY_STATUSES)[number];

export const COPY_CONDITIONS = ["NEW", "GOOD", "FAIR", "DAMAGED", "UNUSABLE"] as const;
export type CopyCondition = (typeof COPY_CONDITIONS)[number];

export const BORROWING_REQUEST_STATUSES = [
  "PENDING",
  "APPROVED",
  "ON_HOLD",
  "RELEASE_REJECTED",
  "CLAIMED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type BorrowingRequestStatus = (typeof BORROWING_REQUEST_STATUSES)[number];

export const LOAN_STATUSES = ["ACTIVE", "RETURNED", "LOST"] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const RENEWAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type RenewalStatus = (typeof RENEWAL_STATUSES)[number];

export const RESERVATION_STATUSES = ["WAITING", "OFFERED", "COLLECTED", "EXPIRED", "CANCELLED"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const FINE_TYPES = ["DAMAGE_MINOR", "DAMAGE_MAJOR", "LOST_BOOK"] as const;
export type FineType = (typeof FINE_TYPES)[number];

export const FINE_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID", "WAIVED"] as const;
export type FineStatus = (typeof FINE_STATUSES)[number];

export const PAYMENT_METHODS = ["CASH", "OTHER_IN_PERSON"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const HANDOVER_ACTIONS = ["CHECKED", "PLACED_ON_HOLD", "REJECTED", "CLAIMED"] as const;
export type HandoverAction = (typeof HANDOVER_ACTIONS)[number];

export const ALLOWED_DURATION_DAYS = [3, 7, 14, 21, 30, 60] as const;
export type AllowedDurationDays = (typeof ALLOWED_DURATION_DAYS)[number];

export const NOTIFICATION_TYPES = [
  "EMAIL_VERIFICATION_REQUIRED",
  "EMAIL_VERIFIED",
  "COR_SUBMITTED",
  "COR_APPROVED",
  "COR_REJECTED",
  "BORROW_REQUEST_APPROVED",
  "BORROW_REQUEST_ON_HOLD",
  "HANDOVER_REJECTED",
  "PICKUP_REMINDER",
  "BORROW_REQUEST_EXPIRED",
  "RESERVATION_CONFIRMED",
  "RESERVATION_OFFERED",
  "RESERVATION_REMINDER",
  "RESERVATION_EXPIRED",
  "LOAN_ISSUED",
  "DUE_SOON",
  "OVERDUE_RESTRICTION",
  "LOAN_RETURNED",
  "RENEWAL_APPROVED",
  "RENEWAL_REJECTED",
  "FINE_RECORDED",
  "FINE_PAYMENT_RECORDED",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_REACTIVATED",
  "GENERAL",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Proposed constants (Notifications PDF). TO CONFIRM.
export const RELATED_ENTITY_TYPES = [
  "USER",
  "STUDENT_VERIFICATION",
  "BORROWING_REQUEST",
  "RESERVATION",
  "LOAN",
  "FINE",
] as const;
export type RelatedEntityType = (typeof RELATED_ENTITY_TYPES)[number];

export const SETTING_VALUE_TYPES = ["STRING", "NUMBER", "BOOLEAN", "JSON"] as const;
export type SettingValueType = (typeof SETTING_VALUE_TYPES)[number];

// Librarian permission keys. Names and storage are TO CONFIRM (TC-08, P15).
// Admin always passes every permission check.
export const LIBRARIAN_PERMISSIONS = ["COR_REVIEW", "CATALOG_MANAGE", "FINE_PAYMENT"] as const;
export type LibrarianPermission = (typeof LIBRARIAN_PERMISSIONS)[number];

// Values of the ?availability= filter are not defined in the source. Proposed. TO CONFIRM.
export const AVAILABILITY_FILTERS = ["AVAILABLE", "UNAVAILABLE"] as const;
export type AvailabilityFilter = (typeof AVAILABILITY_FILTERS)[number];

// Error codes. COR_REQUIRED, OVERDUE_GRACE_EXCEEDED and UNPAID_FINE come from the spec;
// the rest are proposed and shared by all layers (TO CONFIRM).
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "INVALID_CREDENTIALS",
  "ACCOUNT_DISABLED",
  "ACCOUNT_SUSPENDED",
  "EMAIL_NOT_VERIFIED",
  "TOKEN_INVALID_OR_EXPIRED",
  "COR_REQUIRED",
  "COR_EXPIRED",
  "COR_NOT_YET_EFFECTIVE",
  "OVERDUE_GRACE_EXCEEDED",
  "UNPAID_FINE",
  "COMMITMENT_LIMIT_REACHED",
  "SAME_TITLE_LIMIT_REACHED",
  "INVALID_DURATION",
  "NO_COPY_AVAILABLE",
  "COPY_AVAILABLE",
  "INVALID_STATE",
  "ELIGIBILITY_FAILED",
  "RENEWAL_LIMIT_REACHED",
  "RENEWAL_BLOCKED_BY_QUEUE",
  "FILE_TYPE_NOT_ALLOWED",
  "FILE_TOO_LARGE",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];