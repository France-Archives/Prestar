import type { UserRole } from "../types";

// Policy values live in application config (the Database Review stores none in tables).
// The first block is the document's placeholders, to be confirmed by the team.

export const CONFIG = {
  LOAN_DAYS: 7,
  RENEWAL_LIMIT: 1,
  RENEWAL_DAYS: 7,
  MAX_ACTIVE_LOANS: 3,
  MAX_ACTIVE_RESERVATIONS: 3,
  PICKUP_HOLD_DAYS: 2,
  RESERVATION_HOLD_DAYS: 2,
  OVERDUE_FINE_PER_DAY: 5,
  DUE_SOON_DAYS: 2,
  MANUAL_ACCESS_DAYS: 120,
  MIN_INTERESTS: 3,
};

export const ROLES = {
  STUDENT: "Student",
  LIBRARIAN: "Librarian",
  ADMIN: "Admin",
} as const;

export const ROLE_LIST: UserRole[] = ["Student", "Librarian", "Admin"];

export const HOME_BY_ROLE: Record<UserRole, string> = {
  Student: "/student/dashboard",
  Librarian: "/librarian/dashboard",
  Admin: "/admin/dashboard",
};

// Route used by the "Edit interests" action on the student dashboard.
// Must match the route registered in your router.
export const INTEREST_PATH = "/student/interests";

export interface NavItem {
  to: string;
  label: string;
}

// Sidebar items per role (Parts 5.1, 6.1, 7.1 of the design document).

export const NAV: Record<UserRole, NavItem[]> = {
  Student: [
    { to: "/student/dashboard", label: "Home" },
    { to: "/student/books", label: "Books" },
    { to: "/student/requests", label: "My Requests" },
    { to: "/student/borrowing", label: "My Borrowing" },
    { to: "/student/reservations", label: "Reservations" },
    { to: "/student/notifications", label: "Notifications" },
    { to: "/student/profile", label: "Profile" },
  ],

  Librarian: [
    { to: "/librarian/dashboard", label: "Dashboard" },
    { to: "/librarian/catalog", label: "Catalog" },
    { to: "/librarian/inventory", label: "Inventory" },
    { to: "/librarian/requests", label: "Requests" },
    { to: "/librarian/issue", label: "Issue / Handover" },
    { to: "/librarian/loans", label: "Loans" },
    { to: "/librarian/returns", label: "Returns" },
    { to: "/librarian/renewals", label: "Renewals" },
    { to: "/librarian/reservations", label: "Reservations" },
    { to: "/librarian/overdue", label: "Overdue" },
    { to: "/librarian/penalties", label: "Penalties & Suspensions" },
    { to: "/librarian/reports", label: "Reports" },
    { to: "/librarian/profile", label: "Profile" },
  ],

  Admin: [
    { to: "/admin/dashboard", label: "Dashboard" },
    { to: "/admin/users", label: "Users" },
    { to: "/admin/signups", label: "Signups" },
    { to: "/admin/librarians", label: "Librarians" },
    { to: "/admin/catalog", label: "Books / Catalog" },
    { to: "/admin/monitoring", label: "Monitoring" },
    { to: "/admin/reports", label: "Reports" },
    { to: "/admin/activity", label: "System Activity" },
    { to: "/admin/profile", label: "Profile" },
  ],
};