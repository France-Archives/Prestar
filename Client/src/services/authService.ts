import type {
  AcceptInvitationRequest,
  AccountStatus,
  ForgotPasswordRequest,
  Interest,
  LoginRequest,
  RegisterStudentRequest,
  ResendVerificationRequest,
  ResetPasswordRequest,
  SessionUser,
  StudentProfileDetail,
  UserRole,
  UpdateInterestsRequest,
  UpdateProfileRequest,
  VerifyEmailRequest,
} from "@/types";
import { apiClient, apiGet, apiPatch, apiPost, apiPut } from "@/services/apiClient";
import { USE_MOCKS } from "@/utils/constants";
import { ApiError, fail, toApiError, unsupportedOperation } from "@/utils/errors";
import {
  validateInterestSelection,
  validateName,
  validatePassword,
  validateStudentNumber,
  validateWmsuEmail,
  validateYearLevel,
} from "@/utils/validators";
import { begin } from "./mockEngine";
import {
  accountByEmail,
  accountById,
  commit,
  consumeToken,
  db,
  getSessionUserId,
  issueToken,
  latency,
  newId,
  notify,
  nowIso,
  out,
  requireAccount,
  requireStudent,
  sessionUserOf,
  setSessionUserId,
} from "./mockStore";

// Mock passwords are plain text in memory, no email is sent, and mock tokens are returned
// to the browser so the demo can continue.

/** MOCK ONLY: the real API never returns a token. It is returned so the demo can offer an "Open link (demo)" button. */
export interface MockTokenResult {
  mockCode?: string;
  mockToken?: string;
}

export interface ForgotPasswordResult extends MockTokenResult {
  message?: string;
  email?: string;
  cooldownSeconds?: number;
}

interface BackendSignupResponse {
  message: string;
  email: string;
}

interface BackendMessageResponse {
  message: string;
}

const check = (message: string | null): void => {
  if (message) fail("VALIDATION_ERROR", message, 422);
};

interface BackendSessionUser {
  id: number | string;
  email: string;
  role: string;
  accountStatus: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  displayName: string;
  student: {
    id: number | string;
    userId: number | string;
    studentNumber: string;
    middleName: string | null;
    suffix: string | null;
    college: string | null;
    course: string | null;
    program: string | null;
    yearLevel: number | null;
  } | null;
  librarian: null;
}

function isAccountStatus(status: string): status is AccountStatus {
  return ["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION", "DISABLED"].some((value) => value === status);
}

function mapBackendSessionUser(user: BackendSessionUser): SessionUser {
  const roleByBackendRole: Record<string, UserRole> = {
    Student: "STUDENT",
    Librarian: "LIBRARIAN",
    Admin: "ADMIN",
  };
  const role = roleByBackendRole[user.role];
  if (!role) {
    throw new Error(`Unsupported backend user role: ${user.role}`);
  }
  if (!isAccountStatus(user.accountStatus)) {
    throw new Error(`Unsupported backend account status: ${user.accountStatus}`);
  }
  const accountStatus = user.accountStatus;
  return {
    id: String(user.id),
    email: user.email,
    role,
    accountStatus,
    emailVerified: user.emailVerified,
    // /auth/me provides a boolean, not the email verification timestamp.
    emailVerifiedAt: null,
    displayName: user.displayName,
    student: user.student
      ? {
          id: String(user.student.id),
          userId: String(user.student.userId),
          studentNumber: user.student.studentNumber,
          firstName: user.firstName,
          middleName: user.student.middleName,
          lastName: user.lastName,
          suffix: user.student.suffix,
          college: user.student.college,
          program: user.student.program ?? user.student.course,
          yearLevel: user.student.yearLevel,
          registryStatus: "UNKNOWN",
        }
      : null,
    librarian: null,
  };
}

/** A2 POST /auth/login. TC-02 baseline: PENDING_VERIFICATION students may log in (limited); borrowing stays blocked. */
export async function login(req: LoginRequest): Promise<SessionUser> {
  if (!USE_MOCKS) {
    try {
      await apiClient.post<BackendMessageResponse>("/auth/login", req);
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.status === 401) {
        throw new ApiError("INVALID_CREDENTIALS", apiError.message, apiError.status, apiError.details, apiError.requestId);
      }
      throw apiError;
    }
    let backendUser: BackendSessionUser;
    try {
      backendUser = await apiGet<BackendSessionUser>("/auth/me");
    } catch (error) {
      throw toApiError(error);
    }
    return mapBackendSessionUser(backendUser);
  }
  await latency();
  const account = accountByEmail(req.email);
  if (!account || !account.password || account.password !== req.password) fail("INVALID_CREDENTIALS");
  if (account.user.accountStatus === "DISABLED") fail("ACCOUNT_DISABLED", undefined, 403);
  setSessionUserId(account.user.id);
  commit();
  return out(sessionUserOf(account));
}

/** A3 POST /auth/logout */
export async function logout(): Promise<void> {
  if (!USE_MOCKS) {
    await apiPost<void>("/auth/logout");
    return;
  }
  await latency(80);
  setSessionUserId(null);
  commit();
}

/** A8 GET /auth/me. Returns null (instead of a 401) when nobody is signed in, for the app start-up check. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  if (!USE_MOCKS) {
    try {
      return mapBackendSessionUser(await apiGet<BackendSessionUser>("/auth/me"));
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.status === 401) return null;
      throw apiError;
    }
  }
  await latency(120);
  const id = getSessionUserId();
  const account = id ? accountById(id) : undefined;
  if (!account || account.user.accountStatus === "DISABLED") {
    setSessionUserId(null);
    return null;
  }
  return out(sessionUserOf(account));
}

/** A1 POST /auth/register. The role is never read from the request: public signup always creates a STUDENT. */
export async function register(req: RegisterStudentRequest): Promise<{ email: string; mockVerificationCode?: string }> {
  if (!USE_MOCKS) {
    const response = await apiClient.post<BackendSignupResponse>("/auth/signup", req);
    return { email: response.data.email };
  }
  await latency();
  check(validateWmsuEmail(req.email));
  check(validatePassword(req.password));
  check(validateStudentNumber(req.studentNumber));
  check(validateName(req.firstName, "First name"));
  check(validateName(req.middleName ?? "", "Middle name", false));
  check(validateName(req.lastName, "Last name"));
  check(validateName(req.suffix ?? "", "Suffix", false));
  if (!req.termsAccepted || !req.privacyPolicyAccepted) {
    fail("VALIDATION_ERROR", "You must agree to the Terms and the Privacy Policy.", 422);
  }
  // College, course and year level are required on signup.
  if (!req.college?.trim()) fail("VALIDATION_ERROR", "Select your college.", 422);
  if (!req.program?.trim()) fail("VALIDATION_ERROR", "Select your course.", 422);
  if (!req.yearLevel) fail("VALIDATION_ERROR", "Year level is required.", 422);
  check(validateYearLevel(String(req.yearLevel)));
  if (accountByEmail(req.email)) fail("CONFLICT", "An account already exists for this email. Try logging in or resetting your password.");
  if (db.accounts.some((a) => a.student?.studentNumber === req.studentNumber.trim())) fail("CONFLICT", "An account already exists for this student number.");

  const userId = newId();
  const first = req.firstName.trim();
  const last = req.lastName.trim();
  db.accounts.push({
    user: { id: userId, email: req.email.trim().toLowerCase(), role: "STUDENT", accountStatus: "PENDING_VERIFICATION", emailVerifiedAt: null },
    password: req.password,
    displayName: `${first} ${last}`,
    student: {
      id: newId(),
      userId,
      studentNumber: req.studentNumber.trim(),
      firstName: first,
      middleName: req.middleName?.trim() || null,
      lastName: last,
      suffix: req.suffix?.trim() || null,
      college: req.college.trim(),
      program: req.program.trim(), // the selected course
      yearLevel: req.yearLevel,
      registryStatus: "UNKNOWN", // the mock does no university-registry matching
    },
    librarian: null,
    createdAt: nowIso(),
    invitation: null,
  });
  notify(userId, "EMAIL_VERIFICATION_REQUIRED", "Verify your email", "Verify your email to activate your account.", ["USER", userId]);
  const mockVerificationCode = issueToken(userId, "VERIFY_EMAIL", 24);
  commit();
  return { email: req.email.trim().toLowerCase(), mockVerificationCode };
}

/** A4 POST /auth/verify-email. Single-use, expiring one-time code. */
export async function verifyEmail(req: VerifyEmailRequest): Promise<void> {
  if (!USE_MOCKS) {
    await apiClient.post<BackendMessageResponse>("/auth/signup/verify-otp", {
      email: req.email,
      otp: req.code,
    });
    return;
  }
  await latency();
  const account = accountByEmail(req.email);
  if (!account) fail("TOKEN_INVALID_OR_EXPIRED");
  consumeToken(req.code, "VERIFY_EMAIL", account.user.id);
  account.user.emailVerifiedAt = nowIso();
  if (account.user.accountStatus === "PENDING_VERIFICATION") account.user.accountStatus = "ACTIVE";
  notify(account.user.id, "EMAIL_VERIFIED", "Email verified", "Your email has been verified. Submit an approved COR for the current term before borrowing.", ["USER", account.user.id]);
  commit();
}

/** A5 POST /auth/resend-verification. The response is always generic (no account enumeration). */
export async function resendVerification(req: ResendVerificationRequest): Promise<MockTokenResult> {
  if (!USE_MOCKS) {
    await apiClient.post<BackendMessageResponse>("/auth/signup/resend-otp", req);
    return {};
  }
  await latency();
  const account = accountByEmail(req.email);
  if (account && account.user.role === "STUDENT" && !account.user.emailVerifiedAt) {
    return { mockCode: issueToken(account.user.id, "VERIFY_EMAIL", 24) };
  }
  return {};
}

/** A6 POST /auth/forgot-password. The live response is generic for every email. */
export async function forgotPassword(req: ForgotPasswordRequest): Promise<ForgotPasswordResult> {
  if (!USE_MOCKS) {
    try {
      const response = await apiClient.post<{
        message: string;
        email: string;
        cooldown_seconds: number;
      }>("/auth/forgot-password", req);
      return {
        message: response.data.message,
        email: response.data.email,
        cooldownSeconds: response.data.cooldown_seconds,
      };
    } catch (error) {
      throw toApiError(error);
    }
  }
  await latency();
  const account = accountByEmail(req.email);
  if (account && account.password && account.user.accountStatus !== "DISABLED") {
    return { mockToken: issueToken(account.user.id, "RESET_PASSWORD", 1) };
  }
  return {};
}

/** A7 POST /auth/reset-password */
export async function resetPassword(req: ResetPasswordRequest | { token: string; password: string }): Promise<void> {
  if (!USE_MOCKS) {
    if ("token" in req) unsupportedOperation("Token-based password reset");
    try {
      await apiClient.post<BackendMessageResponse>("/auth/reset-password", req);
      return;
    } catch (error) {
      throw toApiError(error);
    }
  }
  if (!("token" in req)) fail("TOKEN_INVALID_OR_EXPIRED");
  await latency();
  check(validatePassword(req.password)); // validate first so a weak password does not burn the token
  const t = consumeToken(req.token, "RESET_PASSWORD");
  const account = accountById(t.userId);
  if (!account) fail("TOKEN_INVALID_OR_EXPIRED");
  account.password = req.password;
  if (getSessionUserId() === account.user.id) setSessionUserId(null); // reset revokes the session
  commit();
}

/** P2 POST /auth/accept-invitation (proposed, TC-19). A Librarian sets a password from the invitation link. */
export async function acceptInvitation(req: AcceptInvitationRequest): Promise<void> {
  if (!USE_MOCKS) unsupportedOperation("Librarian invitation acceptance");
  await latency();
  check(validatePassword(req.password));
  const t = consumeToken(req.token, "INVITATION");
  const account = accountById(t.userId);
  if (!account || account.user.role !== "LIBRARIAN") fail("TOKEN_INVALID_OR_EXPIRED");
  account.password = req.password;
  account.user.emailVerifiedAt = nowIso();
  account.user.accountStatus = "ACTIVE";
  account.invitation = "ACCEPTED";
  commit();
}

// ---------- student profile and interests ----------

/** P1 GET /interests (proposed) */
export async function listInterests(): Promise<Interest[]> {
  return listInterestOptions();
}

const interestsOf = (studentId: string): Interest[] =>
  (db.studentInterests[studentId] ?? []).map((id) => db.interests.find((i) => i.id === id)).filter((i): i is Interest => !!i);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapBackendInterest(value: unknown): Interest {
  if (!isRecord(value)) throw new ApiError("UNKNOWN", "The Server returned an invalid interest.");
  const categoryId = Number(value.categoryId);
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0 || typeof value.name !== "string") {
    throw new ApiError("UNKNOWN", "The Server returned an interest without a valid category ID or name.");
  }
  return {
    id: String(categoryId),
    categoryId,
    name: value.name,
    ...(value.description === null || typeof value.description === "string"
      ? { description: value.description }
      : {}),
  };
}

function mapBackendInterestList(value: unknown): Interest[] {
  if (!Array.isArray(value)) throw new ApiError("UNKNOWN", "The Server returned an invalid interest list.");
  return value.map(mapBackendInterest);
}

/** GET /api/interests. */
export async function listInterestOptions(): Promise<Interest[]> {
  if (!USE_MOCKS) return mapBackendInterestList(await apiGet<unknown>("/interests"));
  await begin();
  requireAccount();
  return out(db.interests);
}

/** GET /api/me/interests. */
export async function getMyInterests(): Promise<Interest[]> {
  if (!USE_MOCKS) return mapBackendInterestList(await apiGet<unknown>("/me/interests"));
  await begin();
  const { student } = requireStudent();
  return out(interestsOf(student.id));
}

/** S1 GET /me/profile */
export async function getMyProfile(): Promise<StudentProfileDetail> {
  if (!USE_MOCKS) {
    const user = mapBackendSessionUser(await apiGet<BackendSessionUser>("/auth/me"));
    if (!user.student) fail("FORBIDDEN", "A student profile is required.", 403);
    return { ...user.student, email: user.email, interests: [] };
  }
  await begin();
  const { account, student } = requireStudent();
  return out({ ...student, email: account.user.email, interests: interestsOf(student.id) });
}

/** S2 PATCH /me/profile. Email is not editable (TC-03). */
export async function updateMyProfile(req: UpdateProfileRequest): Promise<StudentProfileDetail> {
  if (!USE_MOCKS) {
    if (req.middleName !== undefined || req.suffix !== undefined) {
      unsupportedOperation("Updating middle name and suffix");
    }
    const updated = await apiPatch<BackendSessionUser>("/auth/me", {
      ...(req.firstName === undefined ? {} : { firstName: req.firstName }),
      ...(req.lastName === undefined ? {} : { lastName: req.lastName }),
      ...(req.college === undefined ? {} : { college: req.college }),
      ...(req.program === undefined ? {} : { program: req.program }),
      ...(req.yearLevel === undefined ? {} : { yearLevel: req.yearLevel }),
    });
    const user = mapBackendSessionUser(updated);
    if (!user.student) fail("FORBIDDEN", "A student profile is required.", 403);
    return { ...user.student, email: user.email, interests: [] };
  }
  await begin();
  const { account, student } = requireStudent();
  if (req.firstName !== undefined) check(validateName(req.firstName, "First name"));
  if (req.lastName !== undefined) check(validateName(req.lastName, "Last name"));
  if (req.middleName) check(validateName(req.middleName, "Middle name", false));
  if (req.yearLevel !== undefined) {
    if (!req.yearLevel) fail("VALIDATION_ERROR", "Year level is required.", 422);
    check(validateYearLevel(String(req.yearLevel)));
  }
  if (req.firstName !== undefined) student.firstName = req.firstName.trim();
  if (req.lastName !== undefined) student.lastName = req.lastName.trim();
  if (req.middleName !== undefined) student.middleName = req.middleName?.trim() || null;
  if (req.suffix !== undefined) student.suffix = req.suffix?.trim() || null;
  if (req.college !== undefined) student.college = req.college?.trim() || null;
  if (req.program !== undefined) student.program = req.program?.trim() || null;
  if (req.yearLevel !== undefined) student.yearLevel = req.yearLevel;
  account.displayName = `${student.firstName} ${student.lastName}`;
  commit();
  return out({ ...student, email: account.user.email, interests: interestsOf(student.id) });
}

/** PUT /api/me/interests. */
export async function updateMyInterests(req: UpdateInterestsRequest): Promise<Interest[]> {
  if (!USE_MOCKS) {
    check(validateInterestSelection(req.interestIds));
    const interestIds = req.interestIds.map((id) => Number(id));
    if (!interestIds.every((id) => Number.isSafeInteger(id) && id > 0)) {
      fail("VALIDATION_ERROR", "Selected interests must have valid category IDs.", 400);
    }
    return mapBackendInterestList(await apiPut<unknown>("/me/interests", { interestIds }));
  }
  await begin();
  const { student } = requireStudent();
  check(validateInterestSelection(req.interestIds));
  if (!req.interestIds.every((id) => db.interests.some((i) => i.id === id))) fail("VALIDATION_ERROR", "One of the chosen interests does not exist.", 422);
  db.studentInterests[student.id] = [...req.interestIds];
  commit();
  return out(interestsOf(student.id));
}