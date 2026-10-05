import type { ComponentType } from "react";
import AdminCatalog from "./admin/Catalog";
import Activity from "./admin/Activity";
import AdminDashboard from "./admin/Dashboard";
import Librarians from "./admin/Librarians";
import Monitoring from "./admin/Monitoring";
import Reports from "./admin/Reports";
import Signups from "./admin/Signups";
import Users from "./admin/Users";
import LibrarianCatalog from "./librarian/Catalog";
import LibrarianDashboard from "./librarian/Dashboard";
import Inventory from "./librarian/Inventory";
import Issue from "./librarian/Issue";
import Loans from "./librarian/Loans";
import Overdue from "./librarian/Overdue";
import Penalties from "./librarian/Penalties";
import Renewals from "./librarian/Renewals";
import LibrarianReports from "./librarian/Reports";
import LibrarianRequests from "./librarian/Requests";
import LibrarianReservations from "./librarian/Reservations";
import Returns from "./librarian/Returns";
import Profile from "./Profile";
import Books from "./student/Books";
import Borrowing from "./student/Borrowing";
import StudentDashboard from "./student/Dashboard";
import Notifications from "./student/Notifications";
import Requests from "./student/Requests";
import Reservations from "./student/Reservations";

export type PageComponent = ComponentType<{ title: string }>;

// Maps every route path in NAV (utils/constants.ts) to its page component.
// The three role areas stay separate: /student/*, /librarian/*, /admin/*.
export const PAGES: Record<string, PageComponent> = {
  "/student/dashboard": StudentDashboard,
  "/student/books": Books,
  "/student/requests": Requests,
  "/student/borrowing": Borrowing,
  "/student/reservations": Reservations,
  "/student/notifications": Notifications,
  "/student/profile": Profile,
  "/librarian/dashboard": LibrarianDashboard,
  "/librarian/catalog": LibrarianCatalog,
  "/librarian/inventory": Inventory,
  "/librarian/requests": LibrarianRequests,
  "/librarian/issue": Issue,
  "/librarian/loans": Loans,
  "/librarian/returns": Returns,
  "/librarian/renewals": Renewals,
  "/librarian/reservations": LibrarianReservations,
  "/librarian/overdue": Overdue,
  "/librarian/penalties": Penalties,
  "/librarian/reports": LibrarianReports,
  "/librarian/profile": Profile,
  "/admin/dashboard": AdminDashboard,
  "/admin/users": Users,
  "/admin/signups": Signups,
  "/admin/librarians": Librarians,
  "/admin/catalog": AdminCatalog,
  "/admin/monitoring": Monitoring,
  "/admin/reports": Reports,
  "/admin/activity": Activity,
  "/admin/profile": Profile,
};