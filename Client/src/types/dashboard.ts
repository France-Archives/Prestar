import type { ISODateTime, UUID } from "./api";
import type { AccountStatus, BookCopyStatus } from "./enums";
import type { BookSummary } from "./book";
import type { BorrowingRequest, Loan, StaffLoan } from "./borrowing";
import type { CorSummary } from "./verification";
import type { NotificationItem } from "./notification";
import type { Reservation, StaffReservation } from "./reservation";
import type { BookToRelease } from "./staff";

// The source defines only GET /admin/dashboard and three Admin reports (TC-16).
// Student/Staff dashboard data is composed from existing endpoints (or proposed P13). Derived. TO CONFIRM.

export interface PopularBook {
  bookId: UUID;
  title: string;
  loanCount: number;
}

export interface StudentDashboardData {
  accountStatus: AccountStatus;
  emailVerified: boolean;
  cor: CorSummary;
  commitments: { active: number; max: number };
  pickupWaiting: BorrowingRequest[];
  activeLoans: Loan[];
  reservations: Reservation[];
  recentNotifications: NotificationItem[];
  unreadCount: number;
  recommended: BookSummary[];
  mostBorrowed: PopularBook[];
}

export interface StaffDashboardData {
  booksToRelease: BookToRelease[];
  awaitingRelease: number;
  onHold: number;
  pendingCorReviews: number | null; // null when the viewer lacks COR_REVIEW
  overdueLoans: StaffLoan[];
  offeredReservations: StaffReservation[];
  pickupsDueSoon: BookToRelease[];
}

export interface AdminDashboardData {
  totalStudents: number;
  totalLibrarians: number;
  activeLoans: number;
  overdueLoans: number;
  pendingCorReviews: number;
  unpaidFineBalance: number;
  copiesByStatus: Record<BookCopyStatus, number>;
  activityLast7Days: { date: string; loansIssued: number; returns: number }[];
  popularBooks: PopularBook[];
}

// ----- Admin reports (D2 to D4). Row shapes are derived. TO CONFIRM. -----
export interface ReportFilters {
  from?: string; // YYYY-MM-DD
  to?: string;
}

export interface BorrowingReportRow {
  loanId: UUID;
  studentName: string;
  studentNumber: string;
  bookTitle: string;
  borrowedAt: ISODateTime;
  dueAt: ISODateTime;
  returnedAt: ISODateTime | null;
  status: string;
}

export interface OverdueReportRow {
  loanId: UUID;
  studentName: string;
  studentNumber: string;
  bookTitle: string;
  dueAt: ISODateTime;
  overdueDays: number;
}

export interface FinesReportRow {
  fineId: UUID;
  studentName: string;
  studentNumber: string;
  fineType: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: string;
  recordedAt: ISODateTime;
}