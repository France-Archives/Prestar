import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("@/services/apiClient", () => ({
  apiClient: { post: vi.fn() },
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
}));

import { apiClient, apiGet, apiPatch } from "@/services/apiClient";
import {
  getCurrentUser,
  forgotPassword,
  login,
  register,
  resetPassword,
  resendVerification,
  updateMyProfile,
  verifyEmail,
} from "@/services/authService";

const sessionResponse = {
  id: 42,
  email: "ana.reyes@wmsu.edu.ph",
  role: "Student" as const,
  accountStatus: "ACTIVE",
  emailVerified: true,
  firstName: "Ana",
  lastName: "Reyes",
  displayName: "Ana Reyes",
  student: {
    id: 42,
    userId: 42,
    studentNumber: "2026-00123",
    middleName: "Marie",
    suffix: null,
    college: "College of Computer Studies",
    course: "BS Information Technology",
    program: "BS Information Technology",
    yearLevel: 1,
  },
  librarian: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("live signup and session requests", () => {
  it("requests a password reset code and maps the cooldown", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        message: "If that email is registered, a reset code has been sent.",
        email: sessionResponse.email,
        cooldown_seconds: 120,
      },
    });

    await expect(forgotPassword({ email: sessionResponse.email })).resolves.toEqual({
      message: "If that email is registered, a reset code has been sent.",
      email: sessionResponse.email,
      cooldownSeconds: 120,
    });
    expect(apiClient.post).toHaveBeenCalledWith("/auth/forgot-password", { email: sessionResponse.email });
  });

  it.each([
    [400, "Invalid or expired reset code."],
    [429, "Please wait before requesting another code."],
    [503, "The reset email could not be delivered."],
  ] as const)("preserves forgot-password HTTP %i error message", async (status, message) => {
    vi.mocked(apiClient.post).mockRejectedValue({
      isAxiosError: true,
      message: "Request failed",
      response: { status, data: { message } },
    });

    await expect(forgotPassword({ email: sessionResponse.email })).rejects.toMatchObject({ status, message });
  });

  it("submits the reset OTP, password, and confirmation", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: "Password has been reset successfully." } });
    const request = {
      email: sessionResponse.email,
      otp: "847291",
      password: "NewPassword1",
      confirmPassword: "NewPassword1",
    };

    await expect(resetPassword(request)).resolves.toBeUndefined();
    expect(apiClient.post).toHaveBeenCalledWith("/auth/reset-password", request);
  });

  it.each([
    [400, "The reset code is invalid."],
    [404, "No password reset request found for this email."],
    [429, "Too many reset attempts."],
    [503, "The reset email could not be delivered."],
  ] as const)("preserves reset-password HTTP %i error message", async (status, message) => {
    vi.mocked(apiClient.post).mockRejectedValue({
      isAxiosError: true,
      message: "Request failed",
      response: { status, data: { message } },
    });

    await expect(resetPassword({
      email: sessionResponse.email,
      otp: "847291",
      password: "NewPassword1",
      confirmPassword: "NewPassword1",
    })).rejects.toMatchObject({ status, message });
  });

  it("logs in, fetches /me, and maps verified status without inventing a timestamp", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: "Login successful." } });
    vi.mocked(apiGet).mockResolvedValue(sessionResponse);

    const user = await login({ email: sessionResponse.email, password: "StrongPassword123!" });

    expect(apiClient.post).toHaveBeenCalledWith("/auth/login", {
      email: sessionResponse.email,
      password: "StrongPassword123!",
    });
    expect(apiGet).toHaveBeenCalledWith("/auth/me");
    expect(user.id).toBe("42");
    expect(user.role).toBe("STUDENT");
    expect(user.emailVerified).toBe(true);
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.student?.middleName).toBe("Marie");
  });

  it.each([
    ["Student", "STUDENT"],
    ["Librarian", "LIBRARIAN"],
    ["Admin", "ADMIN"],
  ] as const)("uses /me role %s for the session role", async (backendRole, frontendRole) => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: "Login successful." } });
    vi.mocked(apiGet).mockResolvedValue({ ...sessionResponse, role: backendRole, student: null });

    await expect(login({ email: sessionResponse.email, password: "StrongPassword123!" }))
      .resolves.toMatchObject({ role: frontendRole });
  });

  it("maps the backend invalid-credentials response to the login-specific error", async () => {
    vi.mocked(apiClient.post).mockRejectedValue({
      isAxiosError: true,
      message: "Request failed",
      response: { status: 401, data: { error: "Invalid email or password." } },
    });

    await expect(login({ email: sessionResponse.email, password: "wrong" }))
      .rejects.toMatchObject({ code: "INVALID_CREDENTIALS", message: "Invalid email or password." });
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("preserves the unverified email boolean from /me", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: "Login successful." } });
    vi.mocked(apiGet).mockResolvedValue({ ...sessionResponse, emailVerified: false });

    await expect(login({ email: sessionResponse.email, password: "StrongPassword123!" }))
      .resolves.toMatchObject({ emailVerified: false });
  });

  it("surfaces server errors from /me rather than treating them as a signed-in session", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: "Login successful." } });
    vi.mocked(apiGet).mockRejectedValue({
      isAxiosError: true,
      message: "Request failed",
      response: { status: 500, data: { error: "Internal server error." } },
    });

    await expect(login({ email: sessionResponse.email, password: "StrongPassword123!" }))
      .rejects.toMatchObject({ code: "INTERNAL_ERROR", message: "Internal server error." });
  });

  it("returns null when /me reports an unauthenticated session", async () => {
    vi.mocked(apiGet).mockRejectedValue({
      isAxiosError: true,
      message: "Request failed",
      response: { status: 401, data: { error: "Authentication required." } },
    });

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("posts signup with consent and returns no verification code in live mode", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { message: "OTP sent.", email: sessionResponse.email },
    });
    const request = {
      email: sessionResponse.email,
      password: "StrongPassword123!",
      studentNumber: "2026-00123",
      firstName: "Ana",
      middleName: "Marie",
      lastName: "Reyes",
      suffix: null,
      college: "College of Computer Studies",
      program: "BS Information Technology",
      yearLevel: 1,
      termsAccepted: true,
      privacyPolicyAccepted: true,
    };

    await expect(register(request)).resolves.toEqual({ email: sessionResponse.email });
    expect(apiClient.post).toHaveBeenCalledWith("/auth/signup", request);
  });

  it("maps the frontend verification code to the backend otp field", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: "Verified." } });

    await verifyEmail({ email: sessionResponse.email, code: "123456" });

    expect(apiClient.post).toHaveBeenCalledWith("/auth/signup/verify-otp", {
      email: sessionResponse.email,
      otp: "123456",
    });
  });

  it("uses the backend resend route and does not expose a mock code", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: "If pending, sent." } });

    await expect(resendVerification({ email: sessionResponse.email })).resolves.toEqual({});
    expect(apiClient.post).toHaveBeenCalledWith("/auth/signup/resend-otp", {
      email: sessionResponse.email,
    });
  });

  it("updates only the profile fields supported by the Server", async () => {
    vi.mocked(apiPatch).mockResolvedValue(sessionResponse);

    await expect(updateMyProfile({
      firstName: "Ana",
      lastName: "Reyes",
      college: "College of Computer Studies",
      program: "BS Information Technology",
      yearLevel: 2,
    })).resolves.toMatchObject({
      firstName: "Ana",
      yearLevel: 1,
      interests: [],
    });

    expect(apiPatch).toHaveBeenCalledWith("/auth/me", {
      firstName: "Ana",
      lastName: "Reyes",
      college: "College of Computer Studies",
      program: "BS Information Technology",
      yearLevel: 2,
    });
  });

  it("does not silently ignore profile fields the Server cannot update", async () => {
    await expect(updateMyProfile({ middleName: "Marie" }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION", status: 501 });
    expect(apiPatch).not.toHaveBeenCalled();
  });
});
