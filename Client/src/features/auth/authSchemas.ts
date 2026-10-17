import {
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordMatch,
  validateStudentNumber,
  validateYearLevel,
} from "@/utils/validators";

// Client-side form validation for the auth screens. A convenience only: the backend validates again.
// Each validator returns an object of { fieldName: message }. An empty object means the form is valid.

export type FieldErrors = Record<string, string>;
export type FormErrors = FieldErrors;

export interface LoginValues {
  email: string;
  password: string;
}

export interface SignupValues {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  studentNumber: string;
  program: string;
  yearLevel: string;
  email: string;
  password: string;
  confirm: string;
  consent: boolean;
}

function collect(entries: [string, string | null][]): FieldErrors {
  const found: FieldErrors = {};
  for (const [field, message] of entries) {
    if (message) found[field] = message;
  }
  return found;
}

export function validateLogin(v: LoginValues): FieldErrors {
  return collect([
    ["email", validateEmail(v.email)],
    ["password", v.password ? null : "Password is required."],
  ]);
}

/** Used by Reset password (A7) and Accept invitation (P2). */
export function validateNewPassword(password: string, confirm: string): FieldErrors {
  return collect([
    ["password", validatePassword(password)],
    ["confirm", validatePasswordMatch(password, confirm)],
  ]);
}

/** Same rules as validateNewPassword. Kept as a separate name because AcceptInvitationPage imports it. */
export function validatePasswordPair(password: string, confirm: string): FormErrors {
  return validateNewPassword(password, confirm);
}

export function validateSignup(v: SignupValues): FieldErrors {
  const found = collect([
    ["firstName", validateName(v.firstName, "First name")],
    ["lastName", validateName(v.lastName, "Last name")],
    ["middleName", validateName(v.middleName, "Middle name", false)],
    ["studentNumber", validateStudentNumber(v.studentNumber)],
    ["yearLevel", validateYearLevel(v.yearLevel)],
    ["email", validateEmail(v.email)],
    ["password", validatePassword(v.password)],
    ["confirm", validatePasswordMatch(v.password, v.confirm)],
  ]);
  if (!v.consent) found.consent = "You must agree to the Terms and the Privacy Policy.";
  return found;
}