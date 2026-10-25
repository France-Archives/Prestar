// Server/services/adminDashboardService.js
import { Op, QueryTypes } from "sequelize";
import {
  BookCopy,
  BorrowedBook,
  BorrowRequest,
  Penalty,
  Payment,
  StudentVerification,
  User,
  sequelize,
} from "../models/index.js";
import { getTopBorrowedBooks } from "./bookService.js";

const toId = (value) => String(value);

function overdueDays(dueDateValue) {
  if (!dueDateValue) return 0;
  const due = new Date(dueDateValue);
  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((now - due) / (24 * 60 * 60 * 1000));
  return diff > 0 ? diff : 0;
}

function formatPopularBook(book) {
  return {
    id: toId(book.bookId),
    bookId: toId(book.bookId),
    title: book.title,
    loanCount: book.loanCount,
    book: {
      id: toId(book.bookId),
      isbn: book.isbn ?? null,
      title: book.title,
      description: book.description ?? null,
      category: book.category
        ? { id: toId(book.category.id), name: book.category.name }
        : null,
      authors: (book.authors ?? []).map((author) => ({
        id: toId(author.id),
        name: author.name,
      })),
      availability: {
        availableCopies: book.availability.availableCopies,
        totalUsableCopies: book.availability.totalUsableCopies,
      },
      coverImageUrl: book.coverImageUrl ?? null,
    },
  };
}

/**
 * GET /admin/dashboard
 * Returns the data needed by the AdminDashboardPage / AdminStats components.
 */
export async function getAdminDashboardData(userId) {
  // Verify user is admin
  const user = await User.findByPk(userId, {
    attributes: ["user_id", "role", "status"],
  });
  if (!user || user.role !== "Admin") {
    const error = new Error("Admin access required.");
    error.status = 403;
    throw error;
  }

  // Run all count/aggregate queries in parallel
  const [
    totalStudents,
    totalLibrarians,
    activeLoanCount,
    overdueLoanCount,
    pendingCorReviews,
    copiesByStatusRows,
    unpaidFineData,
    activityLast7Days,
    popularBooks,
  ] = await Promise.all([
    // Total students
    User.count({ where: { role: "Student", status: "Active" } }),

    // Total librarians
    User.count({ where: { role: "Librarian", status: "Active" } }),

    // Active loans (Borrowed status)
    BorrowedBook.count({ where: { status: "Borrowed" } }),

    // Overdue loans count
    BorrowedBook.count({
      where: {
        status: "Borrowed",
        due_date: { [Op.lt]: new Date().toISOString().slice(0, 10) },
      },
    }),

    // Pending COR reviews
    StudentVerification.count({ where: { status: "Pending" } }),

    // Copies by status
    sequelize.query(
      `SELECT status, COUNT(*)::int AS count FROM book_copies GROUP BY status ORDER BY status`,
      { type: QueryTypes.SELECT },
    ),

    // Unpaid fine balance
    sequelize.query(
      `SELECT
         COALESCE(SUM(p.amount), 0) AS total_fines,
         COALESCE(SUM(COALESCE(paid.total_paid, 0)), 0) AS total_paid
       FROM penalties p
       LEFT JOIN (
         SELECT penalty_id, SUM(amount) AS total_paid
         FROM payments
         WHERE payment_status = 'Completed'
         GROUP BY penalty_id
       ) paid ON paid.penalty_id = p.penalty_id
       WHERE p.status IN ('Unpaid', 'Partially Paid')`,
      { type: QueryTypes.SELECT },
    ),

    // Activity last 7 days: loans issued and returns per day
    sequelize.query(
      `WITH days AS (
         SELECT generate_series(
           CURRENT_DATE - INTERVAL '6 days',
           CURRENT_DATE,
           INTERVAL '1 day'
         )::date AS day
       )
       SELECT
         d.day::text AS date,
         COALESCE((
           SELECT COUNT(*)::int FROM borrowed_books bb
           WHERE bb.borrow_date::date = d.day AND bb.status IN ('Borrowed', 'Returned')
         ), 0) AS "loansIssued",
         COALESCE((
           SELECT COUNT(*)::int FROM returned_books rb
           WHERE rb.return_date::date = d.day
         ), 0) AS returns
       FROM days d
       ORDER BY d.day ASC`,
      { type: QueryTypes.SELECT },
    ),

    // Popular books (top 10)
    getTopBorrowedBooks(10, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  ]);

  // Build copiesByStatus map
  const COPY_STATUSES = ["Available", "Borrowed", "Reserved", "Lost", "Damaged", "Withdrawn", "In Repair"];
  const copiesByStatus = {};
  for (const s of COPY_STATUSES) {
    copiesByStatus[s.toUpperCase().replace(/\s+/g, "_")] = 0;
  }
  for (const row of copiesByStatusRows) {
    const normalizedKey = String(row.status).toUpperCase().replace(/\s+/g, "_");
    copiesByStatus[normalizedKey] = Number(row.count) || 0;
  }

  // Calculate unpaid balance
  const fineRow = unpaidFineData[0] || {};
  const totalFines = parseFloat(fineRow.total_fines) || 0;
  const totalPaid = parseFloat(fineRow.total_paid) || 0;
  const unpaidFineBalance = Math.round((totalFines - totalPaid) * 100) / 100;

  return {
    totalStudents,
    totalLibrarians,
    activeLoans: activeLoanCount,
    overdueLoans: overdueLoanCount,
    pendingCorReviews,
    unpaidFineBalance: unpaidFineBalance > 0 ? unpaidFineBalance : 0,
    copiesByStatus,
    activityLast7Days,
    popularBooks: popularBooks.map(formatPopularBook),
  };
}
