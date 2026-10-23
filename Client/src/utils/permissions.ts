import type { LibrarianPermission, SessionUser, UserRole } from "@/types";
import { HOME_BY_ROLE } from "@/utils/constants";

// UI role/permission helpers. They only decide what to SHOW. The backend enforces every rule.
//
// Admin rule: Admin can perform every Librarian operation PLUS all Admin-only operations.
// Staff screens are therefore allowed for both LIBRARIAN and ADMIN, and permission-gated Librarian
// capabilities always pass for ADMIN.

export const STAFF_ROLES: readonly UserRole[] = ["LIBRARIAN", "ADMIN"];

export type Capability =
  | "STUDENT_AREA" // own-data student features (borrow, reserve, renew, upload COR)
  | "STAFF_AREA" // circulation: books to release, check penalties, handover, returns, lost, copies views
  | "ADMIN_AREA" // users, terms, settings, policies, reports, audit logs, notifications management
  | "CATALOG_MANAGE" // books, copies, categories, authors
  | "COR_REVIEW" // approve / reject COR
  | "FINE_MANAGE" // assess fines and record payments
  | "FINE_WAIVE" // Admin only, audited
  | "MANAGE_LIBRARIANS"; // invite librarians and assign permissions (Admin only)

const GATED: Partial<Record<Capability, LibrarianPermission>> = {
  CATALOG_MANAGE: "CATALOG_MANAGE",
  COR_REVIEW: "COR_REVIEW",
  FINE_MANAGE: "FINE_PAYMENT",
};

export const isStaffRole = (role: UserRole | null | undefined): boolean => !!role && STAFF_ROLES.includes(role);
export const isAdminRole = (role: UserRole | null | undefined): boolean => role === "ADMIN";

export function can(user: SessionUser | null | undefined, capability: Capability): boolean {
  if (!user) return false;
  const { role } = user;
  if (role === "ADMIN") return capability !== "STUDENT_AREA"; // Admin = Librarian + Admin-only
  if (role === "STUDENT") return capability === "STUDENT_AREA";
  // LIBRARIAN
  if (capability === "STAFF_AREA") return true;
  const needed = GATED[capability];
  return needed ? (user.librarian?.permissions ?? []).includes(needed) : false;
}

/** For route guards: is the user's role one of the allowed roles? */
export const roleAllowed = (role: UserRole | undefined, allowed: readonly UserRole[]): boolean =>
  !!role && allowed.includes(role);

export const homeForRole = (role: UserRole): string => HOME_BY_ROLE[role];