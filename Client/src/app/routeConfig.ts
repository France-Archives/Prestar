import type { SessionUser } from "@/types";
import { can, type Capability } from "@/utils/permissions";

// Route paths and role-based navigation. This is UI access only: hiding a link never protects anything,
// the backend enforces every permission. Admin sees every Librarian screen (can() passes Admin for staff capabilities)
// plus the Admin-only screens, so Admin is a strict superset of Librarian here too.

export const ROUTES = {
  home: "/",
  contact: "/contact",
  terms: "/terms",
  privacy: "/privacy",
  login: "/login",
  signup: "/signup",
  verifyEmail: "/verify-email",
  verificationPending: "/verification-pending",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  acceptInvitation: "/accept-invitation",

  student: {
    dashboard: "/app/dashboard",
    books: "/app/books",
    bookDetails: (id: string) => `/app/books/${id}`,
    interests: "/app/interests",
    borrowings: "/app/borrowing",
    requests: "/app/requests",
    reservations: "/app/reservations",
    renewals: "/app/renewals",
    history: "/app/history",
    cor: "/app/cor",
    uploadCor: "/app/cor/upload",
    profile: "/app/profile",
    notifications: "/app/notifications",
  },

  staff: {
    dashboard: "/staff/dashboard",
    booksToRelease: "/staff/books-to-release",
    handover: (requestId: string) => `/staff/handover/${requestId}`,
    requests: "/staff/requests",
    returns: "/staff/returns",
    reservations: "/staff/reservations",
    renewals: "/staff/renewals",
    penaltyCheck: "/staff/penalty-check",
    fines: "/staff/fines",
    payments: "/staff/payments",
    corReview: "/staff/cor-review",
    books: "/staff/books",
    bookCopies: (bookId: string) => `/staff/books/${bookId}/copies`,
    categories: "/staff/categories",
    authors: "/staff/authors",
    maintenance: "/staff/maintenance",
    notifications: "/staff/notifications",
  },

  admin: {
    dashboard: "/admin/dashboard",
    users: "/admin/users",
    studentDetails: (studentId: string) => `/admin/users/students/${studentId}`,
    librarians: "/admin/librarians",
    books: "/admin/books",
    circulation: "/admin/circulation",
    cor: "/admin/cor",
    terms: "/admin/terms",
    settings: "/admin/settings",
    policies: "/admin/policies",
    finesAndPayments: "/admin/fines",
    reports: "/admin/reports",
    auditLogs: "/admin/audit-logs",
    notifications: "/admin/notifications",
  },
} as const;

export function homePathFor(user: Pick<SessionUser, "role">): string {
  if (user.role === "ADMIN") return ROUTES.admin.dashboard;
  if (user.role === "LIBRARIAN") return ROUTES.staff.dashboard;
  return ROUTES.student.dashboard;
}

export function notificationsPathFor(user: Pick<SessionUser, "role">): string {
  if (user.role === "STUDENT") return ROUTES.student.notifications;
  return ROUTES.staff.notifications;
}

/** Accepts only same-site paths from ?next=, so a crafted link cannot redirect to another site. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next;
}

export interface NavItem {
  label: string;
  to: string;
  capability: Capability;
}

export interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

const S = ROUTES.student;
const T = ROUTES.staff;
const A = ROUTES.admin;

const STUDENT_SECTIONS: NavSection[] = [
  {
    id: "student-library",
    title: "Library",
    items: [
      { label: "Dashboard", to: S.dashboard, capability: "STUDENT_AREA" },
      { label: "Book catalog", to: S.books, capability: "STUDENT_AREA" },
      { label: "My loans", to: S.borrowings, capability: "STUDENT_AREA" },
      { label: "My requests", to: S.requests, capability: "STUDENT_AREA" },
      { label: "Reservations", to: S.reservations, capability: "STUDENT_AREA" },
      { label: "Renewals", to: S.renewals, capability: "STUDENT_AREA" },
      { label: "Borrowing history", to: S.history, capability: "STUDENT_AREA" },
    ],
  },
  {
    id: "student-account",
    title: "Account",
    items: [
      { label: "COR", to: S.cor, capability: "STUDENT_AREA" },
      { label: "My interests", to: S.interests, capability: "STUDENT_AREA" },
      { label: "Profile", to: S.profile, capability: "STUDENT_AREA" },
      { label: "Notifications", to: S.notifications, capability: "STUDENT_AREA" },
    ],
  },
];

const STAFF_SECTIONS: NavSection[] = [
  {
    id: "staff-circulation",
    title: "Circulation",
    items: [
      { label: "Dashboard", to: T.dashboard, capability: "STAFF_AREA" },
      { label: "Books to Release", to: T.booksToRelease, capability: "STAFF_AREA" },
      { label: "Borrowing requests", to: T.requests, capability: "STAFF_AREA" },
      { label: "Returns and loans", to: T.returns, capability: "STAFF_AREA" },
      { label: "Reservations queue", to: T.reservations, capability: "STAFF_AREA" },
      { label: "Renewals", to: T.renewals, capability: "STAFF_AREA" },
      { label: "Check Penalties", to: T.penaltyCheck, capability: "STAFF_AREA" },
    ],
  },
  {
    id: "staff-money",
    title: "Fines and verification",
    items: [
      { label: "Fines", to: T.fines, capability: "STAFF_AREA" },
      { label: "Payments", to: T.payments, capability: "STAFF_AREA" },
      { label: "COR review", to: T.corReview, capability: "COR_REVIEW" },
    ],
  },
  {
    id: "staff-catalog",
    title: "Catalog",
    items: [
      { label: "Books", to: T.books, capability: "CATALOG_MANAGE" },
      { label: "Categories", to: T.categories, capability: "CATALOG_MANAGE" },
      { label: "Authors", to: T.authors, capability: "CATALOG_MANAGE" },
      { label: "Maintenance copies", to: T.maintenance, capability: "CATALOG_MANAGE" },
    ],
  },
  {
    id: "staff-account",
    title: "Account",
    items: [{ label: "Notifications", to: T.notifications, capability: "STAFF_AREA" }],
  },
];

const ADMIN_SECTIONS: NavSection[] = [
  {
    id: "admin-overview",
    title: "Administration",
    items: [
      { label: "Admin dashboard", to: A.dashboard, capability: "ADMIN_AREA" },
      { label: "Circulation overview", to: A.circulation, capability: "ADMIN_AREA" },
      { label: "Reports", to: A.reports, capability: "ADMIN_AREA" },
      { label: "Audit logs", to: A.auditLogs, capability: "ADMIN_AREA" },
    ],
  },
  {
    id: "admin-people",
    title: "People",
    items: [
      { label: "Users", to: A.users, capability: "ADMIN_AREA" },
      { label: "Librarians", to: A.librarians, capability: "MANAGE_LIBRARIANS" },
      { label: "COR administration", to: A.cor, capability: "ADMIN_AREA" },
    ],
  },
  {
    id: "admin-system",
    title: "System",
    items: [
      { label: "Book management", to: A.books, capability: "ADMIN_AREA" },
      { label: "Academic terms", to: A.terms, capability: "ADMIN_AREA" },
      { label: "Borrowing policies", to: A.policies, capability: "ADMIN_AREA" },
      { label: "System settings", to: A.settings, capability: "ADMIN_AREA" },
      { label: "Fines and payments", to: A.finesAndPayments, capability: "ADMIN_AREA" },
      { label: "Notifications management", to: A.notifications, capability: "ADMIN_AREA" },
    ],
  },
];

/** Navigation for the signed-in user. Admin gets every Librarian section plus the Admin sections. */
export function getNavSections(user: SessionUser): NavSection[] {
  const sections = user.role === "STUDENT" ? STUDENT_SECTIONS : [...STAFF_SECTIONS, ...ADMIN_SECTIONS];
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => can(user, i.capability)) }))
    .filter((s) => s.items.length > 0);
}