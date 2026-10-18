import { Op } from "sequelize";
import {
  AcademicTerm,
  Book,
  BorrowedBook,
  BorrowRequest,
  Reservation,
  StudentVerification,
  User,
} from "../models/index.js";
import { MAX_ACTIVE_BORROWS } from "../config/libraryRules.js";
import { getTopBorrowedBooks } from "./bookService.js";

const toId = (value) => String(value);

export function effectiveCorStatus(verification, today) {
  if (!verification) return "MISSING";
  if (verification.status === "Pending") return "PENDING";
  if (verification.status === "Rejected") return "REJECTED";
  if (verification.status === "Expired") return "EXPIRED";
  if (verification.status === "Approved") {
    if (verification.valid_from && today < verification.valid_from) return "NOT_YET_EFFECTIVE";
    if (verification.valid_until && today > verification.valid_until) return "EXPIRED";
    return "APPROVED";
  }
  return "MISSING";
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

export async function getStudentDashboardData(userId) {
  const user = await User.findByPk(userId, {
    attributes: ["user_id", "role", "status", "email_verified"],
  });
  if (!user || user.role !== "Student" || user.status?.toLowerCase() !== "active") {
    const error = new Error("Student account is not active.");
    error.status = 401;
    throw error;
  }

  const activeTerm = await AcademicTerm.findOne({
    where: { status: "Active" },
    attributes: ["term_id", "term_name", "start_date", "end_date", "cor_deadline", "status"],
  });
  const verification = activeTerm
    ? await StudentVerification.findOne({
        where: { user_id: userId, term_id: activeTerm.term_id },
        attributes: ["verification_id", "status", "valid_from", "valid_until"],
      })
    : null;
  const today = new Date().toISOString().slice(0, 10);

  const [pickupRequests, loans, reservations, openRequestCount, activeLoanCount, activeReservationCount, popularBooks] =
    await Promise.all([
      BorrowRequest.findAll({
        where: {
          user_id: userId,
          status: { [Op.in]: ["Approved", "On Hold"] },
        },
        include: [{ model: Book, as: "book", attributes: ["book_id", "title"] }],
        order: [["request_date", "ASC"]],
      }),
      BorrowedBook.findAll({
        where: { status: "Borrowed" },
        include: [
          {
            model: BorrowRequest,
            as: "request",
            where: { user_id: userId },
            attributes: [],
            required: true,
          },
          { model: Book, as: "book", attributes: ["book_id", "title"] },
        ],
        order: [["borrow_id", "DESC"]],
      }),
      Reservation.findAll({
        where: {
          user_id: userId,
          status: { [Op.in]: ["Waiting", "Ready"] },
        },
        include: [{ model: Book, as: "book", attributes: ["book_id", "title"] }],
        order: [["reservation_date", "DESC"]],
      }),
      BorrowRequest.count({
        where: { user_id: userId, status: { [Op.in]: ["Pending", "Approved"] } },
      }),
      BorrowedBook.count({
        where: { status: { [Op.in]: ["Reserved", "Borrowed"] } },
        include: [{
          model: BorrowRequest,
          as: "request",
          where: { user_id: userId },
          attributes: [],
          required: true,
        }],
      }),
      Reservation.count({
        where: { user_id: userId, status: { [Op.in]: ["Waiting", "Ready"] } },
      }),
      getTopBorrowedBooks(5, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    ]);

  const currentTerm = activeTerm
    ? {
        id: toId(activeTerm.term_id),
        name: activeTerm.term_name,
        startDate: activeTerm.start_date,
        endDate: activeTerm.end_date,
        corDeadline: activeTerm.cor_deadline,
        status: String(activeTerm.status).toUpperCase(),
      }
    : null;

  return {
    accountStatus: String(user.status).toUpperCase(),
    emailVerified: user.email_verified === true,
    cor: {
      status: effectiveCorStatus(verification, today),
      currentTerm,
    },
    commitments: {
      active: openRequestCount + activeLoanCount + activeReservationCount,
      max: MAX_ACTIVE_BORROWS,
    },
    pickupWaiting: pickupRequests.map((request) => ({
      id: toId(request.request_id),
      status: request.status === "On Hold" ? "ON_HOLD" : "APPROVED",
    })),
    activeLoans: loans.map((loan) => ({
      id: toId(loan.borrow_id),
      bookTitle: loan.book?.title ?? "",
      status: "ACTIVE",
      dueAt: loan.due_date,
    })),
    reservations: reservations.map((reservation) => ({
      id: toId(reservation.reservation_id),
      status: reservation.status === "Ready" ? "OFFERED" : "WAITING",
    })),
    recentNotifications: null,
    unreadCount: null,
    recommended: null,
    mostBorrowed: popularBooks.map(formatPopularBook),
  };
}
