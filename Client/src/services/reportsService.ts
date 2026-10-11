import type {
  AdminDashboardData,
  BookCopyStatus,
  BorrowingReportRow,
  FinesReportRow,
  OverdueReportRow,
  PopularBook,
  ReportFilters,
  StaffDashboardData,
  StudentDashboardData,
} from "@/types";
import { BOOK_COPY_STATUSES } from "@/types";
import { MOCK_ACTIVITY_LAST_7_DAYS, MOCK_POPULAR_BOOKS, MOCK_RECOMMENDATIONS } from "@/data";
import { LIMITS } from "@/utils/constants";
import { dateKey, daysUntil, overdueDays } from "@/utils/formatDate";
import { roundMoney } from "@/utils/formatCurrency";
import { can } from "@/utils/permissions";
import { begin, corSummaryOf, currentTerm, setting, studentRef, toBookSummary, toBookToRelease, toLoan, toRequest, toReservation, toStaffLoan, toFineSummary, toNotification, queuePosition, copyById, copyRef } from "./mockEngine";
import { db, out, requireCapability, requireStudent, sessionUserOf } from "./mockStore";

// TEMPORARY MOCK IMPLEMENTATION: Replace with backend statistics/reports (P13, D1 to D4).
// The source defines only GET /admin/dashboard and three Admin reports; KPI definitions are TO CONFIRM (TC-16).
// Counts that can be derived from the other mock records are computed live; historical statistics and
// recommendations come from data/mockDashboard.ts.

/** P13 GET /me/dashboard (proposed), composed from S4/S6/B2/B5/B7. */
export async function getStudentDashboard(): Promise<StudentDashboardData> {
  await begin();
  const { account, student } = requireStudent();
  const notes = db.notifications.filter((n) => n.userId === account.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = db.loans.filter((l) => l.studentId === student.id && l.status === "ACTIVE");
  const recommended = (MOCK_RECOMMENDATIONS[student.id] ?? [])
    .map((id) => db.books.find((b) => b.id === id && !b.isArchived))
    .filter((b): b is NonNullable<typeof b> => !!b)
    .map(toBookSummary);

  const commitments =
    active.length +
    db.requests.filter((r) => r.studentId === student.id && (r.status === "APPROVED" || r.status === "ON_HOLD")).length +
    db.reservations.filter((r) => r.studentId === student.id && (r.status === "WAITING" || r.status === "OFFERED")).length;

  return out({
    accountStatus: account.user.accountStatus,
    emailVerified: account.user.emailVerifiedAt !== null,
    cor: corSummaryOf(student.id),
    commitments: { active: commitments, max: setting("MAX_ACTIVE_COMMITMENTS") },
    pickupWaiting: db.requests.filter((r) => r.studentId === student.id && (r.status === "APPROVED" || r.status === "ON_HOLD")).sort((a, b) => (a.pickupDeadline ?? "").localeCompare(b.pickupDeadline ?? "")).map(toRequest),
    activeLoans: active.sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map(toLoan),
    reservations: db.reservations.filter((r) => r.studentId === student.id && (r.status === "WAITING" || r.status === "OFFERED")).map(toReservation),
    recentNotifications: notes.slice(0, 5).map(toNotification),
    unreadCount: notes.filter((n) => n.readAt === null).length,
    recommended,
    mostBorrowed: MOCK_POPULAR_BOOKS.slice(0, 5),
  });
}

/** P13 GET /staff/dashboard (proposed), composed from H1, P4, P5, V1. Admin sees it too. */
export async function getStaffDashboard(): Promise<StaffDashboardData> {
  await begin();
  const account = requireCapability("STAFF_AREA");
  const toRelease = db.requests.filter((r) => r.status === "APPROVED" || r.status === "ON_HOLD").map(toBookToRelease).sort((a, b) => a.pickupDeadline.localeCompare(b.pickupDeadline));
  const canReviewCor = can(sessionUserOf(account), "COR_REVIEW");
  return out({
    booksToRelease: toRelease,
    awaitingRelease: toRelease.filter((b) => b.status === "APPROVED").length,
    onHold: toRelease.filter((b) => b.status === "ON_HOLD").length,
    pendingCorReviews: canReviewCor ? db.cors.filter((c) => c.status === "PENDING").length : null,
    overdueLoans: db.loans.filter((l) => l.status === "ACTIVE" && overdueDays(l.dueAt) > 0).map(toStaffLoan).sort((a, b) => b.overdueDays - a.overdueDays),
    offeredReservations: db.reservations
      .filter((r) => r.status === "OFFERED")
      .map((r) => {
        const copy = r.offeredCopyId ? copyById(r.offeredCopyId) : undefined;
        const { studentId: _studentId, ...base } = r;
        return { ...base, student: studentRef(r.studentId), queuePosition: queuePosition(r), offeredCopy: copy ? copyRef(copy) : null };
      }),
    pickupsDueSoon: toRelease.filter((b) => b.status === "APPROVED" && daysUntil(b.pickupDeadline) <= 1), // window is TO CONFIRM
  });
}

/** D1 GET /admin/dashboard */
export async function getAdminDashboard(): Promise<AdminDashboardData> {
  await begin();
  requireCapability("ADMIN_AREA");
  const copiesByStatus = Object.fromEntries(BOOK_COPY_STATUSES.map((s) => [s, 0])) as Record<BookCopyStatus, number>;
  db.copies.forEach((c) => {
    copiesByStatus[c.status] += 1;
  });
  const unpaid = db.fines.filter((f) => f.status === "UNPAID" || f.status === "PARTIALLY_PAID").reduce((sum, f) => sum + toFineSummary(f).balance, 0);
  void currentTerm;
  return out({
    totalStudents: db.accounts.filter((a) => a.user.role === "STUDENT").length,
    totalLibrarians: db.accounts.filter((a) => a.user.role === "LIBRARIAN").length,
    activeLoans: db.loans.filter((l) => l.status === "ACTIVE").length,
    overdueLoans: db.loans.filter((l) => l.status === "ACTIVE" && overdueDays(l.dueAt) > 0).length,
    pendingCorReviews: db.cors.filter((c) => c.status === "PENDING").length,
    unpaidFineBalance: roundMoney(unpaid),
    copiesByStatus,
    activityLast7Days: MOCK_ACTIVITY_LAST_7_DAYS,
    popularBooks: MOCK_POPULAR_BOOKS,
  });
}

/** Popular titles (derived; no source endpoint). */
export async function getPopularBooks(): Promise<PopularBook[]> {
  await begin();
  return out(MOCK_POPULAR_BOOKS);
}

const inRange = (iso: string, f: ReportFilters): boolean => (!f.from || dateKey(iso) >= f.from) && (!f.to || dateKey(iso) <= f.to);

/** D2 GET /admin/reports/borrowing */
export async function getBorrowingReport(filters: ReportFilters = {}): Promise<BorrowingReportRow[]> {
  await begin();
  requireCapability("ADMIN_AREA");
  return out(
    db.loans
      .filter((l) => inRange(l.borrowedAt, filters))
      .map((l): BorrowingReportRow => {
        const s = studentRef(l.studentId);
        return { loanId: l.id, studentName: `${s.firstName} ${s.lastName}`, studentNumber: s.studentNumber, bookTitle: l.bookTitle, borrowedAt: l.borrowedAt, dueAt: l.dueAt, returnedAt: l.returnedAt, status: l.status };
      })
      .sort((a, b) => b.borrowedAt.localeCompare(a.borrowedAt)),
  );
}

/** D3 GET /admin/reports/overdue */
export async function getOverdueReport(filters: ReportFilters = {}): Promise<OverdueReportRow[]> {
  await begin();
  requireCapability("ADMIN_AREA");
  return out(
    db.loans
      .filter((l) => l.status === "ACTIVE" && overdueDays(l.dueAt) > 0 && inRange(l.dueAt, filters))
      .map((l): OverdueReportRow => {
        const s = studentRef(l.studentId);
        return { loanId: l.id, studentName: `${s.firstName} ${s.lastName}`, studentNumber: s.studentNumber, bookTitle: l.bookTitle, dueAt: l.dueAt, overdueDays: overdueDays(l.dueAt) };
      })
      .sort((a, b) => b.overdueDays - a.overdueDays),
  );
}

/** D4 GET /admin/reports/fines */
export async function getFinesReport(filters: ReportFilters = {}): Promise<FinesReportRow[]> {
  await begin();
  requireCapability("ADMIN_AREA");
  return out(
    db.fines
      .filter((f) => inRange(f.recordedAt, filters))
      .map((f): FinesReportRow => {
        const s = studentRef(f.studentId);
        const sum = toFineSummary(f);
        return { fineId: f.id, studentName: `${s.firstName} ${s.lastName}`, studentNumber: s.studentNumber, fineType: f.fineType, amount: f.amount, paidAmount: sum.paidAmount, balance: sum.balance, status: f.status, recordedAt: f.recordedAt };
      })
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
  );
}

export { LIMITS as _LIMITS };