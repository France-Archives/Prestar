import type { ISODateTime, UUID } from "./api";
import type { AccountStatus, LibrarianPermission, UserRole } from "./enums";

// users -> AuthUser
export interface AuthUser {
  id: UUID;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  emailVerifiedAt: ISODateTime | null; // null = unverified
}

// students -> StudentProfile
export interface StudentProfile {
  id: UUID;
  userId: UUID;
  studentNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  program: string | null;
  yearLevel: number | null; // 1-10
  registryStatus: string; // default 'UNKNOWN'
}

// librarians -> LibrarianProfile (derived). permissions storage is TO CONFIRM (TC-08).
export interface LibrarianProfile {
  id: UUID;
  userId: UUID;
  employeeNumber: string | null;
  permissions: LibrarianPermission[];
}

/**
 * What the app holds after GET /auth/me (A8). The exact response shape is not defined in the source,
 * so this is a frontend convenience that merges AuthUser with the matching profile. TO CONFIRM.
 */
export interface SessionUser extends AuthUser {
  displayName: string;
  student: StudentProfile | null;
  librarian: LibrarianProfile | null;
}

/** Short student reference used by staff tables. */
export interface StudentRef {
  id: UUID;
  studentNumber: string;
  firstName: string;
  lastName: string;
}

/** Reading interest. Source of P1 GET /interests (TO CONFIRM). */
export interface Interest {
  id: UUID;
  name: string;
}

/** S1 GET /me/profile. Interests are included for convenience. TO CONFIRM. */
export interface StudentProfileDetail extends StudentProfile {
  email: string;
  interests: Interest[];
}

// ----- Request bodies -----

// NO role field. The backend always creates STUDENT.
export interface RegisterStudentRequest {
  email: string;
  password: string;
  studentNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  suffix?: string | null;
  program?: string | null;
  yearLevel?: number | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** A2 response. The session mechanism (cookie vs token) is TO CONFIRM (TC-01). */
export interface LoginResponse {
  user: SessionUser;
}

export interface VerifyEmailRequest {
  token: string;
}
export interface ResendVerificationRequest {
  email: string;
}
export interface ForgotPasswordRequest {
  email: string;
}
export interface ResetPasswordRequest {
  token: string;
  password: string;
}
/** P2 POST /auth/accept-invitation (proposed). */
export interface AcceptInvitationRequest {
  token: string;
  password: string;
}

/** S2 PATCH /me/profile. Email change policy is TO CONFIRM (TC-03), so email is not editable. */
export interface UpdateProfileRequest {
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  suffix?: string | null;
  program?: string | null;
  yearLevel?: number | null;
}

/** S3 PUT /me/interests: exactly 3 distinct ids. */
export interface UpdateInterestsRequest {
  interestIds: [UUID, UUID, UUID];
}