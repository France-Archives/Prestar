import type {
  ConditionStatus,
  CopyStatus,
  MatchStatus,
  StudentType,
  SuspensionReason,
} from "./db";

// Every mock API call returns this, exactly like a real endpoint wrapper would.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ----- eligibility (Part 10.2, conditions A to F) -----
export type EligibilityCode = "A" | "B" | "C" | "D" | "E" | "F";
export type EligibilityAction = "request" | "reserve" | "renew" | "promote";
export interface EligibilityIssue {
  code: EligibilityCode;
  message: string;
}

// ----- derived display values -----
export interface AvailabilityInfo {
  free: number;
  circulating: number;
  totalCopies: number;
  queueLength: number;
}

export type BookActionType = "request" | "reserve" | "borrowed" | "requested" | "reserved" | "unavailable";
export interface BookActionState {
  action: BookActionType;
  label: string;
  disabled: boolean;
  reason: string | null;
}

export interface RenewalState {
  ok: boolean;
  reason: string | null;
}

export interface AppNotification {
  id: string;
  type: "request" | "reservation" | "loan" | "penalty" | "suspension";
  title: string;
  text: string;
  date: string;
  to: string;
}

export type Standing = "OK" | "Inactive" | "Not enrolled" | "Suspended" | "Penalty" | "Overdue" | "—";

export interface SignupLookup {
  reference_no: string;
  email: string;
  first_name: string;
  match_status: MatchStatus;
  status: import("./db").SignupStatus;
  email_verified_at: string | null;
  remarks: string | null;
}

export type SignupDecision = "Approve" | "Reject" | "Info";

// ----- form types -----
export type LoginFormData = { email: string; password: string };

export type RegisterFormData = {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  studentType: StudentType;
  studentId: string;
  noStudentId: boolean;
  previousSchool: string;
  course: string;
  yearLevel: string;
  email: string;
  password: string;
  confirm: string;
  consent: boolean; // validated but not stored (Decision A)
};

export type PasswordFormData = { current: string; next: string; confirm: string };
export type LibrarianFormData = { firstName: string; lastName: string; email: string; password: string };
export type SuspensionFormData = { reasonType: SuspensionReason; reasonDetails: string; endDate: string };

export type BookFormData = {
  book_id?: number;
  title: string;
  author: string;
  isbn?: string;
  category_id: number | string;
  publisher?: string;
  year_published?: number | string;
  edition?: string;
  description?: string;
  cover_image?: string;
  shelf_location?: string;
  price?: number | string | null;
};

export type ReturnFormData = {
  borrowId: number;
  condition: ConditionStatus;
  scannedAccessionNo?: string;
  remarks?: string;
  damagedAmount?: number | string | null;
};

export type CopyUpdate = { status?: CopyStatus; condition_status?: ConditionStatus };