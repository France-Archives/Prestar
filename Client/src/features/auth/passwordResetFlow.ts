import type { ResetPasswordRequest } from "@/types";
import { toApiError } from "@/utils/errors";
import { validateEmail } from "@/utils/validators";

export interface ResetPasswordValues extends ResetPasswordRequest {}

export interface ResetPasswordErrors {
  email?: string;
  otp?: string;
  password?: string;
  confirmPassword?: string;
}

export function validateForgotPassword(email: string): string | null {
  return validateEmail(email);
}

export function validateResetPassword(values: ResetPasswordValues): ResetPasswordErrors {
  const errors: ResetPasswordErrors = {};
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  if (!/^\d{6}$/.test(values.otp)) errors.otp = "Enter the 6-digit code.";
  if (values.password.length < 8) errors.password = "Password must be at least 8 characters.";
  if (values.confirmPassword !== values.password) errors.confirmPassword = "Passwords do not match.";
  return errors;
}

export function mapResetPasswordError(error: unknown): {
  fieldErrors: ResetPasswordErrors;
  formError: string | null;
  requestNewCode: boolean;
  preserveCooldown: boolean;
} {
  const apiError = toApiError(error);
  const message = apiError.message;
  const text = message.toLowerCase();

  if (apiError.status === 429) {
    return { fieldErrors: {}, formError: message, requestNewCode: false, preserveCooldown: true };
  }
  if (apiError.status === 503 || apiError.code === "NETWORK_ERROR") {
    return { fieldErrors: {}, formError: message, requestNewCode: false, preserveCooldown: false };
  }
  if (apiError.status === 404) {
    return {
      fieldErrors: { email: message },
      formError: null,
      requestNewCode: true,
      preserveCooldown: false,
    };
  }
  if (apiError.status === 400) {
    if (/attempt/.test(text) && /too many|maximum|limit|five|5/.test(text)) {
      return { fieldErrors: { otp: message }, formError: null, requestNewCode: true, preserveCooldown: false };
    }
    if (/confirm|match/.test(text)) {
      return { fieldErrors: { confirmPassword: message }, formError: null, requestNewCode: false, preserveCooldown: false };
    }
    if (/otp|code|expired|invalid/.test(text)) {
      return { fieldErrors: { otp: message }, formError: null, requestNewCode: false, preserveCooldown: false };
    }
    if (/password/.test(text)) {
      return { fieldErrors: { password: message }, formError: null, requestNewCode: false, preserveCooldown: false };
    }
    if (/email/.test(text)) {
      return { fieldErrors: { email: message }, formError: null, requestNewCode: false, preserveCooldown: false };
    }
  }

  return { fieldErrors: {}, formError: message, requestNewCode: false, preserveCooldown: false };
}

export function formatCooldown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function tickCooldown(seconds: number): number {
  return Math.max(0, seconds - 1);
}

export function cooldownAfterResendFailure(current: number, status: number): number {
  return status === 429 ? Math.max(current, 120) : current;
}

export function resetStepNavigation(email: string, cooldownSeconds: number, message: string) {
  return {
    email: email.trim(),
    cooldownSeconds,
    message,
  };
}

export function loginAfterResetNavigation() {
  return {
    notice: "Password updated, you can log in.",
  };
}
