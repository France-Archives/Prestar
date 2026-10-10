import type {
  AcceptInvitationRequest,
  ForgotPasswordRequest,
  Interest,
  LoginRequest,
  RegisterStudentRequest,
  ResendVerificationRequest,
  ResetPasswordRequest,
  SessionUser,
  StudentProfileDetail,
  UpdateInterestsRequest,
  UpdateProfileRequest,
  VerifyEmailRequest,
} from "@/types";
import { fail } from "@/utils/errors";
import {
  validateEmail,
  validateInterestSelection,
  validateName,
  validatePassword,
  validateStudentNumber,
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

// TEMPORARY MOCK IMPLEMENTATION: Replace with the real authentication endpoints (A1 to A8, A9 acceptance P2) and
// the student profile endpoints (S1 to S3, P1). Mock authentication, email verification and password reset are NOT
// real: passwords are plain text in memory, no email is sent, and tokens are returned to the browser so the demo
// can continue. A real backend hashes passwords, emails a link and never returns the token.

/** MOCK ONLY: the real API never returns a token. It is returned so the demo can offer an "Open link (demo)" button. */
export interface MockTokenResult {
  mockToken?: string;
}

const check = (message: string | null): void => {
  if (message) fail("VALIDATION_ERROR", message, 422);
};

/** A2 POST /auth/login. TC-02 baseline: PENDING_VERIFICATION students may log in (limited); borrowing stays blocked. */
export async function login(req: LoginRequest): Promise<SessionUser> {
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
  await latency(80);
  setSessionUserId(null);
  commit();
}

/** A8 GET /auth/me. Returns null (instead of a 401) when nobody is signed in, for the app start-up check. */
export async function getCurrentUser(): Promise<SessionUser | null> {
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
export async function register(req: RegisterStudentRequest): Promise<{ email: string } & { mockVerificationToken: string }> {
  await latency();
  check(validateEmail(req.email));
  check(validatePassword(req.password));
  check(validateStudentNumber(req.studentNumber));
  check(validateName(req.firstName, "First name"));
  check(validateName(req.lastName, "Last name"));
  check(validateName(req.middleName ?? "", "Middle name", false));
  check(validateYearLevel(req.yearLevel ? String(req.yearLevel) : ""));
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
      program: req.program?.trim() || null,
      yearLevel: req.yearLevel ?? null,
      registryStatus: "UNKNOWN", // the mock does no university-registry matching
    },
    librarian: null,
    createdAt: nowIso(),
    invitation: null,
  });
  notify(userId, "EMAIL_VERIFICATION_REQUIRED", "Verify your email", "Verify your email to activate your account.", ["USER", userId]);
  const mockVerificationToken = issueToken(userId, "VERIFY_EMAIL", 24);
  commit();
  return { email: req.email.trim().toLowerCase(), mockVerificationToken };
}

/** A4 POST /auth/verify-email. Single-use, expiring token. */
export async function verifyEmail(req: VerifyEmailRequest): Promise<void> {
  await latency();
  const t = consumeToken(req.token, "VERIFY_EMAIL");
  const account = accountById(t.userId);
  if (!account) fail("TOKEN_INVALID_OR_EXPIRED");
  account.user.emailVerifiedAt = nowIso();
  if (account.user.accountStatus === "PENDING_VERIFICATION") account.user.accountStatus = "ACTIVE";
  notify(account.user.id, "EMAIL_VERIFIED", "Email verified", "Your email has been verified. Submit an approved COR for the current term before borrowing.", ["USER", account.user.id]);
  commit();
}

/** A5 POST /auth/resend-verification. The response is always generic (no account enumeration). */
export async function resendVerification(req: ResendVerificationRequest): Promise<MockTokenResult> {
  await latency();
  const account = accountByEmail(req.email);
  if (account && account.user.role === "STUDENT" && !account.user.emailVerifiedAt) {
    return { mockToken: issueToken(account.user.id, "VERIFY_EMAIL", 24) };
  }
  return {};
}

/** A6 POST /auth/forgot-password. Generic response. */
export async function forgotPassword(req: ForgotPasswordRequest): Promise<MockTokenResult> {
  await latency();
  const account = accountByEmail(req.email);
  if (account && account.password && account.user.accountStatus !== "DISABLED") {
    return { mockToken: issueToken(account.user.id, "RESET_PASSWORD", 1) };
  }
  return {};
}

/** A7 POST /auth/reset-password */
export async function resetPassword(req: ResetPasswordRequest): Promise<void> {
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
  await begin();
  requireAccount();
  return out(db.interests);
}

const interestsOf = (studentId: string): Interest[] =>
  (db.studentInterests[studentId] ?? []).map((id) => db.interests.find((i) => i.id === id)).filter((i): i is Interest => !!i);

/** S1 GET /me/profile */
export async function getMyProfile(): Promise<StudentProfileDetail> {
  await begin();
  const { account, student } = requireStudent();
  return out({ ...student, email: account.user.email, interests: interestsOf(student.id) });
}

/** S2 PATCH /me/profile. Email is not editable (TC-03). */
export async function updateMyProfile(req: UpdateProfileRequest): Promise<StudentProfileDetail> {
  await begin();
  const { account, student } = requireStudent();
  if (req.firstName !== undefined) check(validateName(req.firstName, "First name"));
  if (req.lastName !== undefined) check(validateName(req.lastName, "Last name"));
  if (req.middleName) check(validateName(req.middleName, "Middle name", false));
  if (req.yearLevel !== undefined && req.yearLevel !== null) check(validateYearLevel(String(req.yearLevel)));
  if (req.firstName !== undefined) student.firstName = req.firstName.trim();
  if (req.lastName !== undefined) student.lastName = req.lastName.trim();
  if (req.middleName !== undefined) student.middleName = req.middleName?.trim() || null;
  if (req.suffix !== undefined) student.suffix = req.suffix?.trim() || null;
  if (req.program !== undefined) student.program = req.program?.trim() || null;
  if (req.yearLevel !== undefined) student.yearLevel = req.yearLevel;
  account.displayName = `${student.firstName} ${student.lastName}`;
  commit();
  return out({ ...student, email: account.user.email, interests: interestsOf(student.id) });
}

/** S3 PUT /me/interests: exactly 3 distinct interests. */
export async function updateMyInterests(req: UpdateInterestsRequest): Promise<Interest[]> {
  await begin();
  const { student } = requireStudent();
  check(validateInterestSelection(req.interestIds));
  if (!req.interestIds.every((id) => db.interests.some((i) => i.id === id))) fail("VALIDATION_ERROR", "One of the chosen interests does not exist.", 422);
  db.studentInterests[student.id] = [...req.interestIds];
  commit();
  return out(interestsOf(student.id));
}