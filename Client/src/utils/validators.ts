import { ALLOWED_DURATION_DAYS } from "@/types";
import { COR_UPLOAD, LIMITS, PASSWORD_POLICY } from "@/utils/constants";

// Client-side validation is a CONVENIENCE only. The backend validates every request again.
// Every validator returns an error message, or null when the value is fine.

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_REGEX = /^\p{L}[\p{L}\s'.-]*$/u;
const STUDENT_NUMBER_REGEX = /^[A-Za-z0-9-]+$/; // format is TO CONFIRM
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: string) => UUID_REGEX.test(v);

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return "Email is required.";
  return EMAIL_REGEX.test(v) ? null : "Enter a valid email address.";
}

export function validateRequired(value: string, label: string, maxLength?: number): string | null {
  const v = value.trim();
  if (!v) return `${label} is required.`;
  if (maxLength && v.length > maxLength) return `${label} must be ${maxLength} characters or fewer.`;
  return null;
}

export function validateName(value: string, label: string, required = true, maxLength = 100): string | null {
  const v = value.trim();
  if (!v) return required ? `${label} is required.` : null;
  if (v.length > maxLength) return `${label} must be ${maxLength} characters or fewer.`;
  return NAME_REGEX.test(v) ? null : `${label} may contain letters only.`;
}

export function validateStudentNumber(value: string): string | null {
  const v = value.trim();
  if (!v) return "Student number is required.";
  if (v.length > 50) return "Student number must be 50 characters or fewer.";
  return STUDENT_NUMBER_REGEX.test(v) ? null : "Use letters, numbers and dashes only.";
}

export function validateYearLevel(value: string): string | null {
  if (!value.trim()) return null; // optional
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? null : "Year level must be 1 to 10.";
}

/** Baseline policy: 8+ characters, a letter and a number. Final policy is TO CONFIRM (TC-03). */
export interface PasswordCheck {
  label: string;
  ok: boolean;
}
export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { label: `At least ${PASSWORD_POLICY.MIN_LENGTH} characters`, ok: password.length >= PASSWORD_POLICY.MIN_LENGTH },
    { label: "A letter", ok: /[A-Za-z]/.test(password) },
    { label: "A number", ok: /\d/.test(password) },
  ];
}
export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  return passwordChecks(password).every((c) => c.ok)
    ? null
    : `Use ${PASSWORD_POLICY.MIN_LENGTH}+ characters with a letter and a number.`;
}
/** 0 to 4, for the strength meter. Extra points for mixed case and symbols. */
export function passwordScore(password: string): number {
  if (!password) return 0;
  let score = passwordChecks(password).filter((c) => c.ok).length; // 0..3
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password) && password.length >= 12) score += 1;
  return Math.min(4, score);
}
export function validatePasswordMatch(password: string, confirm: string): string | null {
  return password === confirm ? null : "Passwords do not match.";
}

export function validateDuration(days: number): string | null {
  return (ALLOWED_DURATION_DAYS as readonly number[]).includes(days) ? null : "Choose 3, 7, 14, 21, 30 or 60 days.";
}

/** Exactly 3 distinct interests. */
export function validateInterestSelection(ids: string[]): string | null {
  const unique = new Set(ids);
  if (unique.size !== ids.length) return "Choose different interests.";
  return unique.size === LIMITS.INTEREST_COUNT ? null : `Choose exactly ${LIMITS.INTEREST_COUNT} interests.`;
}

export function validateCorFile(file: { name: string; size: number; type: string } | null | undefined): string | null {
  if (!file) return "Choose a file to upload.";
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const typeOk = (COR_UPLOAD.ALLOWED_MIME as readonly string[]).includes(file.type);
  const extOk = (COR_UPLOAD.ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
  if (!typeOk || !extOk) return "Only PDF, JPG or PNG files are allowed.";
  if (file.size > COR_UPLOAD.MAX_BYTES) return `File must be ${COR_UPLOAD.MAX_BYTES / (1024 * 1024)} MB or smaller.`;
  return null;
}

export function validateDateRange(start: string, end: string, label = "End date"): string | null {
  if (!start || !end) return null;
  return end > start ? null : `${label} must be after the start date.`;
}

export function validatePositiveAmount(value: string, max?: number): string | null {
  const n = Number(value);
  if (!value.trim() || Number.isNaN(n) || n <= 0) return "Enter an amount greater than 0.";
  if (max !== undefined && n > max) return "Amount cannot be more than the balance.";
  return null;
}