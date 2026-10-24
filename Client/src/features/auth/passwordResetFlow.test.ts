import { describe, expect, it } from "vitest";
import {
  cooldownAfterResendFailure,
  formatCooldown,
  loginAfterResetNavigation,
  mapResetPasswordError,
  resetStepNavigation,
  tickCooldown,
  validateForgotPassword,
  validateResetPassword,
} from "./passwordResetFlow";

function serverError(status: number, message: string) {
  return {
    isAxiosError: true,
    message: "Request failed",
    response: { status, data: { message } },
  };
}

describe("password reset flow", () => {
  it("validates the email and reset form fields", () => {
    expect(validateForgotPassword("not-an-email")).toBe("Enter a valid email address.");
    expect(validateResetPassword({
      email: "reader@example.edu",
      otp: "12345x",
      password: "short",
      confirmPassword: "different",
    })).toEqual({
      otp: "Enter the 6-digit code.",
      password: "Password must be at least 8 characters.",
      confirmPassword: "Passwords do not match.",
    });
    expect(validateResetPassword({
      email: "reader@example.edu",
      otp: "123456",
      password: "eightchars",
      confirmPassword: "eightchars",
    })).toEqual({});
  });

  it("carries the email and server cooldown to the reset-code step", () => {
    expect(resetStepNavigation(" reader@example.edu ", 120, "Generic message.")).toEqual({
      email: "reader@example.edu",
      cooldownSeconds: 120,
      message: "Generic message.",
    });
  });

  it("counts down and formats the resend delay", () => {
    expect(tickCooldown(120)).toBe(119);
    expect(tickCooldown(0)).toBe(0);
    expect(formatCooldown(105)).toBe("1:45");
  });

  it("keeps or restarts the resend countdown after rate limiting", () => {
    expect(cooldownAfterResendFailure(24, 429)).toBe(120);
    expect(cooldownAfterResendFailure(90, 429)).toBe(120);
    expect(cooldownAfterResendFailure(90, 503)).toBe(90);
  });

  it("maps invalid code, too many attempts, mismatch, and missing request to their fields", () => {
    expect(mapResetPasswordError(serverError(400, "The reset code is invalid or expired.")).fieldErrors)
      .toEqual({ otp: "The reset code is invalid or expired." });
    expect(mapResetPasswordError(serverError(400, "Too many incorrect attempts. Request a new code.")).requestNewCode)
      .toBe(true);
    expect(mapResetPasswordError(serverError(400, "Passwords do not match.")).fieldErrors)
      .toEqual({ confirmPassword: "Passwords do not match." });
    expect(mapResetPasswordError(serverError(404, "No password reset request found for this email.")).fieldErrors)
      .toEqual({ email: "No password reset request found for this email." });
  });

  it.each([429, 503])("keeps HTTP %i messages in the form alert", (status) => {
    const mapped = mapResetPasswordError(serverError(status, `Server message ${status}`));
    expect(mapped.formError).toBe(`Server message ${status}`);
    expect(mapped.fieldErrors).toEqual({});
  });

  it("passes a success notice to login without an authenticated session", () => {
    expect(loginAfterResetNavigation()).toEqual({ notice: "Password updated, you can log in." });
  });
});
