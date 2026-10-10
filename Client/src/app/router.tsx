import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import type { Capability } from "@/utils/permissions";
import { GuestOnly, PageLoading, RequireAuth, RequireCapability } from "./guards";
import { ROUTES } from "./routeConfig";
import PublicLayout from "@/layouts/PublicLayout";
import StudentLayout from "@/layouts/StudentLayout";
import StaffLayout from "@/layouts/StaffLayout";
import AdminLayout from "@/layouts/AdminLayout";

// All application routes. Pages are lazy-loaded and must default-export their component.
// Layouts live in src/layouts (Batch 6); pages in src/features/*/pages (Batch 7).

const page = (loader: () => Promise<{ default: ComponentType }>) => lazy(loader);

const P = {
  // public
  Landing: page(() => import("@/features/public-site/pages/LandingPage")),
  Contact: page(() => import("@/features/public-site/pages/ContactPage")),
  Terms: page(() => import("@/features/public-site/pages/TermsPage")),
  Privacy: page(() => import("@/features/public-site/pages/PrivacyPage")),
  NotFound: page(() => import("@/features/public-site/pages/NotFoundPage")),
  // auth
  Login: page(() => import("@/features/auth/pages/LoginPage")),
  Signup: page(() => import("@/features/auth/pages/SignupPage")),
  VerifyEmail: page(() => import("@/features/auth/pages/VerifyEmailPage")),
  VerificationPending: page(() => import("@/features/auth/pages/VerificationPendingPage")),
  ForgotPassword: page(() => import("@/features/auth/pages/ForgotPasswordPage")),
  ResetPassword: page(() => import("@/features/auth/pages/ResetPasswordPage")),
  AcceptInvitation: page(() => import("@/features/auth/pages/AcceptInvitationPage")),
  // books (shared by every role)
  BookCatalog: page(() => import("@/features/books/pages/BookCatalogPage")),
  BookDetails: page(() => import("@/features/books/pages/BookDetailsPage")),
  // student
  StudentDashboard: page(() => import("@/features/student/pages/StudentDashboardPage")),
  MyInterests: page(() => import("@/features/student/pages/MyInterestsPage")),
  MyBorrowings: page(() => import("@/features/student/pages/MyBorrowingsPage")),
  MyRequests: page(() => import("@/features/student/pages/MyRequestsPage")),
  MyReservations: page(() => import("@/features/student/pages/MyReservationsPage")),
  RenewalRequests: page(() => import("@/features/student/pages/RenewalRequestsPage")),
  BorrowingHistory: page(() => import("@/features/student/pages/BorrowingHistoryPage")),
  StudentProfile: page(() => import("@/features/student/pages/StudentProfilePage")),
  StudentVerification: page(() => import("@/features/student/pages/StudentVerificationPage")),
  UploadCOR: page(() => import("@/features/student/pages/UploadCORPage")),
  // librarian / staff
  LibrarianDashboard: page(() => import("@/features/librarian/pages/LibrarianDashboardPage")),
  BooksToRelease: page(() => import("@/features/librarian/pages/BooksToReleasePage")),
  HandoverDetails: page(() => import("@/features/librarian/pages/HandoverDetailsPage")),
  BorrowingRequests: page(() => import("@/features/librarian/pages/BorrowingRequestsPage")),
  Returns: page(() => import("@/features/librarian/pages/ReturnsPage")),
  ReservationsQueue: page(() => import("@/features/librarian/pages/ReservationsQueuePage")),
  RenewalManagement: page(() => import("@/features/librarian/pages/RenewalManagementPage")),
  PenaltyCheck: page(() => import("@/features/librarian/pages/PenaltyCheckPage")),
  FinesManagement: page(() => import("@/features/librarian/pages/FinesManagementPage")),
  PaymentRecording: page(() => import("@/features/librarian/pages/PaymentRecordingPage")),
  CORReview: page(() => import("@/features/librarian/pages/CORReviewPage")),
  ManageBooks: page(() => import("@/features/librarian/pages/ManageBooksPage")),
  BookCopies: page(() => import("@/features/librarian/pages/BookCopiesPage")),
  ManageCategories: page(() => import("@/features/librarian/pages/ManageCategoriesPage")),
  ManageAuthors: page(() => import("@/features/librarian/pages/ManageAuthorsPage")),
  MaintenanceCopies: page(() => import("@/features/librarian/pages/MaintenanceCopiesPage")),
  // admin
  AdminDashboard: page(() => import("@/features/admin/pages/AdminDashboardPage")),
  UserManagement: page(() => import("@/features/admin/pages/UserManagementPage")),
  StudentDetails: page(() => import("@/features/admin/pages/StudentDetailsPage")),
  LibrarianManagement: page(() => import("@/features/admin/pages/LibrarianManagementPage")),
  BookManagement: page(() => import("@/features/admin/pages/BookManagementPage")),
  CirculationOverview: page(() => import("@/features/admin/pages/CirculationOverviewPage")),
  CORAdministration: page(() => import("@/features/admin/pages/CORAdministrationPage")),
  AcademicTerms: page(() => import("@/features/admin/pages/AcademicTermsPage")),
  SystemSettings: page(() => import("@/features/admin/pages/SystemSettingsPage")),
  BorrowingPolicies: page(() => import("@/features/admin/pages/BorrowingPoliciesPage")),
  FinesAndPayments: page(() => import("@/features/admin/pages/FinesAndPaymentsPage")),
  Reports: page(() => import("@/features/admin/pages/ReportsPage")),
  AuditLogs: page(() => import("@/features/admin/pages/AuditLogsPage")),
  NotificationsManagement: page(() => import("@/features/admin/pages/NotificationsManagementPage")),
  // notifications (student and staff share this page)
  Notifications: page(() => import("@/features/notifications/pages/NotificationsPage")),
};

const el = (Component: LazyExoticComponent<ComponentType>) => (
  <Suspense fallback={<PageLoading />}>
    <Component />
  </Suspense>
);

/** A route that additionally needs a capability (Admin always passes staff capabilities). */
const gated = (capability: Capability, children: RouteObject[]): RouteObject => ({
  element: <RequireCapability capability={capability} />,
  children,
});

const studentRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="dashboard" replace /> },
  { path: "dashboard", element: el(P.StudentDashboard) },
  { path: "books", element: el(P.BookCatalog) },
  { path: "books/:bookId", element: el(P.BookDetails) },
  { path: "interests", element: el(P.MyInterests) },
  { path: "borrowing", element: el(P.MyBorrowings) },
  { path: "requests", element: el(P.MyRequests) },
  { path: "reservations", element: el(P.MyReservations) },
  { path: "renewals", element: el(P.RenewalRequests) },
  { path: "history", element: el(P.BorrowingHistory) },
  { path: "cor", element: el(P.StudentVerification) },
  { path: "cor/upload", element: el(P.UploadCOR) },
  { path: "profile", element: el(P.StudentProfile) },
  { path: "notifications", element: el(P.Notifications) },
];

const staffRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="dashboard" replace /> },
  { path: "dashboard", element: el(P.LibrarianDashboard) },
  { path: "books-to-release", element: el(P.BooksToRelease) },
  { path: "handover/:requestId", element: el(P.HandoverDetails) },
  { path: "requests", element: el(P.BorrowingRequests) },
  { path: "returns", element: el(P.Returns) },
  { path: "reservations", element: el(P.ReservationsQueue) },
  { path: "renewals", element: el(P.RenewalManagement) },
  { path: "penalty-check", element: el(P.PenaltyCheck) },
  { path: "fines", element: el(P.FinesManagement) },
  { path: "payments", element: el(P.PaymentRecording) },
  { path: "notifications", element: el(P.Notifications) },
  gated("COR_REVIEW", [{ path: "cor-review", element: el(P.CORReview) }]),
  gated("CATALOG_MANAGE", [
    { path: "books", element: el(P.ManageBooks) },
    { path: "books/:bookId/copies", element: el(P.BookCopies) },
    { path: "categories", element: el(P.ManageCategories) },
    { path: "authors", element: el(P.ManageAuthors) },
    { path: "maintenance", element: el(P.MaintenanceCopies) },
  ]),
];

const adminRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="dashboard" replace /> },
  { path: "dashboard", element: el(P.AdminDashboard) },
  { path: "users", element: el(P.UserManagement) },
  { path: "users/students/:studentId", element: el(P.StudentDetails) },
  { path: "books", element: el(P.BookManagement) },
  { path: "circulation", element: el(P.CirculationOverview) },
  { path: "cor", element: el(P.CORAdministration) },
  { path: "terms", element: el(P.AcademicTerms) },
  { path: "settings", element: el(P.SystemSettings) },
  { path: "policies", element: el(P.BorrowingPolicies) },
  { path: "fines", element: el(P.FinesAndPayments) },
  { path: "reports", element: el(P.Reports) },
  { path: "audit-logs", element: el(P.AuditLogs) },
  { path: "notifications", element: el(P.NotificationsManagement) },
  gated("MANAGE_LIBRARIANS", [{ path: "librarians", element: el(P.LibrarianManagement) }]),
];

export const router = createBrowserRouter([
  // Public site
  {
    element: <PublicLayout />,
    children: [
      { path: ROUTES.home, element: el(P.Landing) },
      { path: ROUTES.contact, element: el(P.Contact) },
      { path: ROUTES.terms, element: el(P.Terms) },
      { path: ROUTES.privacy, element: el(P.Privacy) },
    ],
  },
  // Signed-out only
  {
    element: <GuestOnly />,
    children: [
      { path: ROUTES.login, element: el(P.Login) },
      { path: ROUTES.signup, element: el(P.Signup) },
      { path: ROUTES.forgotPassword, element: el(P.ForgotPassword) },
    ],
  },
  // Token links and post-signup screens: reachable whether or not someone is signed in
  { path: ROUTES.verifyEmail, element: el(P.VerifyEmail) },
  { path: ROUTES.verificationPending, element: el(P.VerificationPending) },
  { path: ROUTES.resetPassword, element: el(P.ResetPassword) },
  { path: ROUTES.acceptInvitation, element: el(P.AcceptInvitation) },
  // Signed-in areas
  {
    element: <RequireAuth />,
    children: [
      {
        path: "/app",
        element: <RequireCapability capability="STUDENT_AREA" />,
        children: [{ element: <StudentLayout />, children: studentRoutes }],
      },
      {
        path: "/staff",
        element: <RequireCapability capability="STAFF_AREA" />,
        children: [{ element: <StaffLayout />, children: staffRoutes }],
      },
      {
        path: "/admin",
        element: <RequireCapability capability="ADMIN_AREA" />,
        children: [{ element: <AdminLayout />, children: adminRoutes }],
      },
    ],
  },
  { path: "*", element: el(P.NotFound) },
]);