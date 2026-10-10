import type { AccountStatus, AuthUser, ISODateTime, LibrarianPermission, LibrarianProfile, StudentProfile } from "@/types";
import { NS, at, uid } from "./mockHelpers";

// TEMPORARY MOCK IMPLEMENTATION: fake student, librarian and admin records. Development/testing ONLY.
// DO NOT use fake accounts or plain-text passwords in production. Replace with POST /auth/login (A2) and GET /auth/me (A8).
// The real backend stores only a slow salted password hash and never sends it to the browser.

export const DEMO_PASSWORD = "Password123";

export interface MockAccount {
  user: AuthUser;
  password: string; // MOCK ONLY: plain text. Empty = no password set yet (pending invitation).
  displayName: string;
  student: StudentProfile | null;
  librarian: LibrarianProfile | null;
  createdAt: ISODateTime;
  invitation: "PENDING" | "ACCEPTED" | null; // Librarians only (TC-19)
}

export const USER_ID = {
  admin: uid(NS.user, 1),
  leo: uid(NS.user, 2), // Librarian with every permission
  mara: uid(NS.user, 3), // Librarian with NO extra permissions (shows permission gating)
  nico: uid(NS.user, 4), // Librarian invitation not yet accepted
  ana: uid(NS.user, 5),
  ben: uid(NS.user, 6),
  carla: uid(NS.user, 7),
  dan: uid(NS.user, 8),
  ella: uid(NS.user, 9),
  felix: uid(NS.user, 10),
  gina: uid(NS.user, 11),
} as const;

export const STUDENT_ID = {
  ana: uid(NS.student, 1),
  ben: uid(NS.student, 2),
  carla: uid(NS.student, 3),
  dan: uid(NS.student, 4),
  ella: uid(NS.student, 5),
  felix: uid(NS.student, 6),
  gina: uid(NS.student, 7),
} as const;

type StudentKey = keyof typeof STUDENT_ID;

interface StudentSeed {
  key: StudentKey;
  first: string;
  middle?: string;
  last: string;
  number: string;
  program: string;
  year: number;
  status: AccountStatus;
  verified: boolean;
  createdDays: number;
}

const STUDENT_SEEDS: StudentSeed[] = [
  { key: "ana", first: "Ana", last: "Reyes", number: "2024-00101", program: "BS Computer Science", year: 3, status: "ACTIVE", verified: true, createdDays: -300 },
  { key: "ben", first: "Ben", middle: "Cruz", last: "Lim", number: "2024-00102", program: "BS Information Technology", year: 2, status: "ACTIVE", verified: true, createdDays: -280 },
  { key: "carla", first: "Carla", last: "Diaz", number: "2023-00087", program: "BS Education", year: 4, status: "ACTIVE", verified: true, createdDays: -500 },
  { key: "dan", first: "Dan", last: "Uy", number: "2025-00210", program: "BS Business Administration", year: 1, status: "ACTIVE", verified: true, createdDays: -70 },
  { key: "ella", first: "Ella", last: "Santos", number: "2026-00015", program: "BS Nursing", year: 1, status: "PENDING_VERIFICATION", verified: false, createdDays: -1 },
  { key: "felix", first: "Felix", last: "Ramos", number: "2022-00444", program: "BS Civil Engineering", year: 4, status: "SUSPENDED", verified: true, createdDays: -700 },
  { key: "gina", first: "Gina", last: "Cruz", number: "2025-00318", program: "BS Biology", year: 2, status: "ACTIVE", verified: true, createdDays: -90 },
];

const studentAccounts: MockAccount[] = STUDENT_SEEDS.map((s, i): MockAccount => {
  const createdAt = at(s.createdDays);
  return {
    user: {
      id: USER_ID[s.key],
      email: `${s.first.toLowerCase()}.${s.last.toLowerCase()}@university.edu`,
      role: "STUDENT",
      accountStatus: s.status,
      emailVerifiedAt: s.verified ? at(s.createdDays, 1) : null,
    },
    password: DEMO_PASSWORD,
    displayName: `${s.first} ${s.last}`,
    student: {
      id: STUDENT_ID[s.key],
      userId: USER_ID[s.key],
      studentNumber: s.number,
      firstName: s.first,
      middleName: s.middle ?? null,
      lastName: s.last,
      suffix: null,
      program: s.program,
      yearLevel: s.year,
      // The mock performs no university-registry matching, so the status stays at the DB default.
      registryStatus: "UNKNOWN",
    },
    librarian: null,
    createdAt,
    invitation: null,
    // index only keeps ordering stable for readers
    ...(i >= 0 ? {} : {}),
  };
});

const librarian = (
  key: "leo" | "mara" | "nico",
  n: number,
  name: string,
  email: string,
  employeeNumber: string,
  permissions: LibrarianPermission[],
  invitation: "PENDING" | "ACCEPTED",
  createdDays: number,
): MockAccount => ({
  user: {
    id: USER_ID[key],
    email,
    role: "LIBRARIAN",
    accountStatus: invitation === "PENDING" ? "PENDING_VERIFICATION" : "ACTIVE",
    emailVerifiedAt: invitation === "PENDING" ? null : at(createdDays, 1),
  },
  password: invitation === "PENDING" ? "" : DEMO_PASSWORD,
  displayName: name,
  student: null,
  librarian: { id: uid(NS.librarian, n), userId: USER_ID[key], employeeNumber, permissions },
  createdAt: at(createdDays),
  invitation,
});

export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    user: { id: USER_ID.admin, email: "admin@university.edu", role: "ADMIN", accountStatus: "ACTIVE", emailVerifiedAt: at(-600, 1) },
    password: DEMO_PASSWORD,
    displayName: "Mia Santos",
    student: null,
    librarian: null,
    createdAt: at(-600),
    invitation: null,
  },
  librarian("leo", 1, "Leo Cruz", "leo.cruz@university.edu", "EMP-001", ["COR_REVIEW", "CATALOG_MANAGE", "FINE_PAYMENT"], "ACCEPTED", -400),
  librarian("mara", 2, "Mara Tan", "mara.tan@university.edu", "EMP-002", [], "ACCEPTED", -200),
  librarian("nico", 3, "Nico Perez", "nico.perez@university.edu", "EMP-003", ["CATALOG_MANAGE"], "PENDING", -2),
  ...studentAccounts,
];

/** Shown on the login page ONLY while mocks are on, so reviewers can try every role. */
export const DEMO_CREDENTIALS: { role: string; email: string; note: string }[] = [
  { role: "Admin", email: "admin@university.edu", note: "Every Librarian operation plus Admin tools" },
  { role: "Librarian (all permissions)", email: "leo.cruz@university.edu", note: "COR review, catalog, fines and payments" },
  { role: "Librarian (no extra permissions)", email: "mara.tan@university.edu", note: "Circulation only; gated screens are hidden" },
  { role: "Student (has loans)", email: "ana.reyes@university.edu", note: "Active loans, offered reservation" },
  { role: "Student (restricted)", email: "carla.diaz@university.edu", note: "Overdue loan and unpaid fine" },
  { role: "Student (no COR)", email: "dan.uy@university.edu", note: "Cannot borrow until a COR is approved" },
  { role: "Student (unverified email)", email: "ella.santos@university.edu", note: "Pending email verification" },
  { role: "Student (suspended)", email: "felix.ramos@university.edu", note: "Can browse; cannot borrow" },
];