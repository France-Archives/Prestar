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
import { apiGet } from "@/services/apiClient";
import { ApiError } from "@/utils/errors";
import { USE_MOCKS } from "@/utils/constants";
import { MOCK_ACTIVITY_LAST_7_DAYS, MOCK_POPULAR_BOOKS, MOCK_RECOMMENDATIONS } from "@/data";
import { LIMITS } from "@/utils/constants";
import { dateKey, daysUntil, overdueDays } from "@/utils/formatDate";
import { roundMoney } from "@/utils/formatCurrency";
import { can } from "@/utils/permissions";
import { begin, corSummaryOf, currentTerm, setting, studentRef, toBookSummary, toBookToRelease, toReservationBookToRelease, toLoan, toRequest, toReservation, toStaffLoan, toFineSummary, toNotification, queuePosition, copyById, copyRef } from "./mockEngine";
import { db, out, requireCapability, requireStudent, sessionUserOf } from "./mockStore";
import { mapRecommendedBook } from "./booksService";

// Student dashboard uses the live endpoint when configured; staff/admin reports remain mock-only.
// The source defines only GET /admin/dashboard and three Admin reports (TC-16). KPI definitions are TO CONFIRM (TC-16).
// The source defines only GET /admin/dashboard and three Admin reports; KPI definitions are TO CONFIRM (TC-16).
// Counts that can be derived from the other mock records are computed live; historical statistics and
// recommendations come from data/mockDashboard.ts.

function normalizedStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "_") : "";
}

function mapDashboardBook(value: unknown): PopularBook["book"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const book = value as Record<string, unknown>;
  const category = book.category && typeof book.category === "object"
    ? book.category as Record<string, unknown>
    : null;
  const authors = Array.isArray(book.authors) ? book.authors : [];
  const availability = book.availability && typeof book.availability === "object"
    ? book.availability as Record<string, unknown>
    : {};
  const availableCopies = Number(availability.availableCopies ?? book.availableCopies ?? 0);
  return {
    id: String(book.id ?? book.bookId),
    title: String(book.title ?? ""),
    isbn: typeof book.isbn === "string" ? book.isbn : null,
    description: typeof book.description === "string" ? book.description : null,
    category: category
      ? { id: String(category.id), name: String(category.name ?? "") }
      : null,
    authors: authors.flatMap((author) => {
      if (!author || typeof author !== "object") return [];
      const row = author as Record<string, unknown>;
      return [{ id: String(row.id), name: String(row.name ?? "") }];
    }),
    availability: {
      availableCopies,
      totalUsableCopies: Number(availability.totalUsableCopies ?? availableCopies),
    },
    coverImageUrl: typeof book.coverImageUrl === "string" ? book.coverImageUrl : null,
  };
}

function mapStudentDashboard(value: StudentDashboardData): StudentDashboardData {
  const response = value as StudentDashboardData & Record<string, unknown>;
  const cor = response.cor as Record<string, unknown>;
  const currentTerm = cor.currentTerm && typeof cor.currentTerm === "object"
    ? cor.currentTerm as Record<string, unknown>
    : null;
  const popularRows = Array.isArray(response.mostBorrowed) ? response.mostBorrowed : [];
  const recommendedRows: unknown = response.recommended;
  if (recommendedRows !== null && !Array.isArray(recommendedRows)) {
    throw new ApiError("UNKNOWN", "The Server returned an invalid recommended book list.");
  }
  return {
    ...response,
    accountStatus: normalizedStatus(response.accountStatus) as StudentDashboardData["accountStatus"],
    emailVerified: Boolean(response.emailVerified),
    cor: {
      status: normalizedStatus(cor.status) as StudentDashboardData["cor"]["status"],
      currentTerm: currentTerm
        ? { id: String(currentTerm.id), name: String(currentTerm.name ?? "") }
        : null,
    },
    commitments: {
      active: Number(response.commitments?.active ?? 0),
      max: Number(response.commitments?.max ?? 0),
    },
    pickupWaiting: (response.pickupWaiting ?? []).map((request) => ({
      id: String(request.id),
      status: normalizedStatus(request.status),
    })),
    activeLoans: (response.activeLoans ?? []).map((loan) => ({
      id: String(loan.id),
      bookTitle: loan.bookTitle,
      status: "ACTIVE",
      dueAt: loan.dueAt,
    })),
    reservations: (response.reservations ?? []).map((reservation) => ({
      id: String(reservation.id),
      status: normalizedStatus(reservation.status) === "READY" ? "OFFERED" : normalizedStatus(reservation.status),
    })),
    recentNotifications: response.recentNotifications ?? null,
    unreadCount: response.unreadCount === null || response.unreadCount === undefined
      ? null
      : Number(response.unreadCount),
    recommended: recommendedRows === null ? null : recommendedRows.map(mapRecommendedBook),
    mostBorrowed: popularRows.map((row) => {
      const item = row as PopularBook & Record<string, unknown>;
      return {
        bookId: String(item.bookId ?? item.id),
        title: item.title,
        loanCount: Number(item.loanCount ?? 0),
        book: mapDashboardBook(item.book),
      };
    }),
  };
}

/** P13 GET /me/dashboard. */
export async function getStudentDashboard(): Promise<StudentDashboardData> {
  if (!USE_MOCKS) return mapStudentDashboard(await apiGet<StudentDashboardData>("/me/dashboard"));
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
  if (!USE_MOCKS) return apiGet<StaffDashboardData>("/staff/dashboard");
  await begin();
  const account = requireCapability("STAFF_AREA");
  const toRelease = [
    ...db.requests.filter((r) => r.status === "APPROVED" || r.status === "ON_HOLD").map(toBookToRelease),
    ...db.reservations.filter((r) => r.status === "OFFERED").map(toReservationBookToRelease),
  ].sort((a, b) => (a.pickupDeadline ?? "").localeCompare(b.pickupDeadline ?? ""));
  const canReviewCor = can(sessionUserOf(account), "COR_REVIEW");
  return out({
    booksToRelease: toRelease,
    awaitingRelease: toRelease.filter((b) => b.status === "APPROVED" || b.status === "OFFERED").length,
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
    pickupsDueSoon: toRelease.filter((b) => (b.status === "APPROVED" || b.status === "OFFERED") && b.pickupDeadline !== null && daysUntil(b.pickupDeadline) <= 1), // window is TO CONFIRM
  });
}

/** D1 GET /admin/dashboard */
export async function getAdminDashboard(): Promise<AdminDashboardData> {
  if (!USE_MOCKS) return apiGet<AdminDashboardData>("/admin/dashboard");
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
  if (!USE_MOCKS) return apiGet<BorrowingReportRow[]>("/admin/reports/borrowing", filters);
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
  if (!USE_MOCKS) return apiGet<OverdueReportRow[]>("/admin/reports/overdue", filters);
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
  if (!USE_MOCKS) return apiGet<FinesReportRow[]>("/admin/reports/fines", filters);
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