// Server/services/reservationService.js
import { Op } from "sequelize";
import {
  Book,
  BookCopy,
  BorrowedBook,
  BorrowRequest,
  Reservation,
  User,
  sequelize,
} from "../models/index.js";
import {
  MAX_ACTIVE_BORROWS,
  MAX_COPIES_PER_BOOK,
  PICKUP_WINDOW_DAYS,
} from "../config/libraryRules.js";
import { checkBorrowEligibility } from "./borrowEligibilityService.js";
import withActor from "../utils/withActor.js";
import { createNotification } from "./notificationService.js";

function formatNoticeDate(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export class ReservationError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = "ReservationError";
    this.status = status;
    this.code = code;
    this.reasons = extra.reasons || [];
    this.details = extra;
  }
}

/**
 * Checkpoint 1: Student creates / joins a reservation queue for a book.
 * Allowed only when no copies are available in inventory.
 * Enforces all student flags, same-title limit, and total active borrows limit.
 */
export async function createReservation({ userId, bookId, requestedDays = 7 }) {
  // 1. Verify active book exists
  const book = await Book.findOne({
    where: { book_id: bookId, status: "Active" },
    attributes: ["book_id", "title", "status"],
  });
  if (!book) {
    throw new ReservationError(404, "BOOK_NOT_FOUND", "Reservation rejected: Active book not found.");
  }

  // 2. Check if a copy is available (reservation is only for out-of-stock books)
  const availableCopiesCount = await BookCopy.count({
    where: {
      book_id: bookId,
      status: "Available",
      condition_status: "Good",
    },
  });
  if (availableCopiesCount > 0) {
    throw new ReservationError(
      409,
      "COPY_AVAILABLE",
      "A copy of this book is currently available to borrow directly; reservation is not needed.",
    );
  }

  // 3. Evaluate student eligibility flags (Account, Suspension, Term, COR, Penalties)
  const eligibility = await checkBorrowEligibility(userId);
  if (!eligibility.eligible) {
    const primaryReason = eligibility.reasons[0];
    const reasonMsg = primaryReason?.message || "Student is not eligible to reserve books.";
    throw new ReservationError(
      403,
      primaryReason?.code || "RESERVATION_INELIGIBLE",
      `Reservation rejected: ${reasonMsg}`,
      { reasons: eligibility.reasons },
    );
  }

  // 4. Duplicate queue entry check (a student cannot join the queue twice for the same title)
  const alreadyInQueue = await Reservation.findOne({
    where: {
      user_id: userId,
      book_id: bookId,
      status: { [Op.in]: ["Waiting", "Ready"] },
    },
  });
  if (alreadyInQueue) {
    throw new ReservationError(
      409,
      "DUPLICATE_RESERVATION",
      "Reservation rejected: You are already in the reservation queue for this title.",
    );
  }

  // 5. Same-Title limit check: MAX_COPIES_PER_BOOK (active loans + approved requests + active reservations)
  const activeLoansForBook = await BorrowedBook.count({
    where: {
      book_id: bookId,
      status: { [Op.in]: ["Reserved", "Borrowed"] },
    },
    include: [
      {
        model: BorrowRequest,
        as: "request",
        where: { user_id: userId },
        required: true,
      },
    ],
  });

  const activeRequestsForBook = await BorrowRequest.count({
    where: {
      user_id: userId,
      book_id: bookId,
      status: { [Op.in]: ["Pending", "Approved"] },
    },
  });

  const activeReservationsForBook = await Reservation.count({
    where: {
      user_id: userId,
      book_id: bookId,
      status: { [Op.in]: ["Waiting", "Ready"] },
    },
  });

  if (activeLoansForBook + activeRequestsForBook + activeReservationsForBook >= MAX_COPIES_PER_BOOK) {
    throw new ReservationError(
      409,
      "MAX_COPIES_PER_BOOK_EXCEEDED",
      `Reservation rejected: You already have active loans, requests, or queue entries for this title, reaching the limit of ${MAX_COPIES_PER_BOOK} per title.`,
    );
  }

  // 5. Total active library limit check: MAX_ACTIVE_BORROWS
  const totalActiveLoans = await BorrowedBook.count({
    where: {
      status: { [Op.in]: ["Reserved", "Borrowed"] },
    },
    include: [
      {
        model: BorrowRequest,
        as: "request",
        where: { user_id: userId },
        required: true,
      },
    ],
  });

  const totalOpenRequests = await BorrowRequest.count({
    where: {
      user_id: userId,
      status: { [Op.in]: ["Pending", "Approved"] },
    },
  });

  const totalActiveReservations = await Reservation.count({
    where: {
      user_id: userId,
      status: { [Op.in]: ["Waiting", "Ready"] },
    },
  });

  if (totalActiveLoans + totalOpenRequests + totalActiveReservations >= MAX_ACTIVE_BORROWS) {
    throw new ReservationError(
      409,
      "MAX_ACTIVE_BORROWS_EXCEEDED",
      `Reservation rejected: You have reached the maximum allowed limit of ${MAX_ACTIVE_BORROWS} active book loans/requests/reservations.`,
    );
  }

  // 6. Join FIFO reservation queue
  try {
    return await withActor(userId, async (transaction) => {
      const reservation = await Reservation.create(
        {
          user_id: userId,
          book_id: bookId,
          reservation_date: new Date(),
          status: "Waiting",
          remarks: `Requested loan duration: ${requestedDays} days`,
        },
        { transaction },
      );

      // Compute FIFO queue position
      const queuePosition = await Reservation.count({
        where: {
          book_id: bookId,
          status: "Waiting",
          [Op.or]: [
            { reservation_date: { [Op.lt]: reservation.reservation_date } },
            {
              reservation_date: reservation.reservation_date,
              reservation_id: { [Op.lte]: reservation.reservation_id },
            },
          ],
        },
        transaction,
      });

      try {
        await createNotification({
          userId,
          type: "RESERVATION_CONFIRMED",
          title: "Reservation confirmed",
          message: `You are in the reservation queue for "${book.title}". We will notify you when a copy is offered.`,
          relatedEntityType: "RESERVATION",
          relatedEntityId: reservation.reservation_id,
          transaction,
        });
      } catch (notifErr) {
        console.warn("[Notification] Error creating RESERVATION_CONFIRMED notification:", notifErr.message);
      }

      return {
        message: "You have joined the reservation queue successfully.",
        reservationId: reservation.reservation_id,
        id: reservation.reservation_id,
        bookId: reservation.book_id,
        bookTitle: book.title,
        status: reservation.status,
        queuePosition,
        reservedAt: reservation.reservation_date,
      };
    });
  } catch (err) {
    if (err?.original?.code === "23505") {
      throw new ReservationError(
        409,
        "DUPLICATE_RESERVATION",
        "You are already in the reservation queue for this title.",
      );
    }
    throw err;
  }
}

/**
 * List student's own reservations.
 */
export async function listMyReservations(userId, query = {}) {
  const where = { user_id: userId };
  if (query.status && query.status.trim()) {
    where.status = query.status.trim();
  }

  const reservations = await Reservation.findAll({
    where,
    include: [
      {
        model: Book,
        as: "book",
        attributes: ["book_id", "title", "isbn"],
      },
    ],
    order: [["reservation_date", "DESC"]],
  });

  const formatted = await Promise.all(
    reservations.map(async (r) => {
      let queuePosition = null;
      if (r.status === "Waiting") {
        queuePosition = await Reservation.count({
          where: {
            book_id: r.book_id,
            status: "Waiting",
            [Op.or]: [
              { reservation_date: { [Op.lt]: r.reservation_date } },
              {
                reservation_date: r.reservation_date,
                reservation_id: { [Op.lte]: r.reservation_id },
              },
            ],
          },
        });
      }

      return {
        id: r.reservation_id,
        reservationId: r.reservation_id,
        bookId: r.book_id,
        bookTitle: r.book?.title || "Unknown Book",
        isbn: r.book?.isbn || null,
        status: r.status,
        queuePosition,
        reservedAt: r.reservation_date,
        pickupDeadline: r.expires_at,
        closedAt: r.closed_at,
        remarks: r.remarks,
      };
    }),
  );

  return { reservations: formatted };
}

/**
 * Student cancels their own waiting or ready reservation.
 */
export async function cancelReservation({ reservationId, userId }) {
  return withActor(userId, async (transaction) => {
    const reservation = await Reservation.findOne({
      where: { reservation_id: reservationId, user_id: userId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!reservation) {
      throw new ReservationError(404, "RESERVATION_NOT_FOUND", "Reservation not found.");
    }

    if (reservation.status !== "Waiting" && reservation.status !== "Ready") {
      throw new ReservationError(
        409,
        "INVALID_STATE",
        "This reservation can no longer be cancelled.",
      );
    }

    // If reservation was Ready, release the assigned copy and cancel the loan
    if (reservation.status === "Ready") {
      const loan = await BorrowedBook.findOne({
        where: {
          book_id: reservation.book_id,
          status: "Reserved",
        },
        include: [
          {
            model: BorrowRequest,
            as: "request",
            where: { user_id: userId },
            required: true,
          },
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (loan) {
        await loan.update({ status: "Cancelled" }, { transaction });
        await BookCopy.update(
          { status: "Available" },
          { where: { copy_id: loan.copy_id }, transaction },
        );
      }
    }

    await reservation.update(
      {
        status: "Cancelled",
        closed_at: new Date(),
        remarks: "Cancelled by student",
      },
      { transaction },
    );

    // Asynchronously dispatch the next waiting student in queue
    setImmediate(() => {
      processNextInReservationQueue(reservation.book_id).catch((err) => {
        console.error("[Reservation Dispatch Error on Cancel]:", err.message);
      });
    });

    return {
      message: "Reservation cancelled successfully.",
      reservationId: reservation.reservation_id,
      status: "Cancelled",
    };
  });
}

/**
 * Checkpoint 2: Automated Queue Processor.
 * Invoked whenever a copy of a book becomes 'Available'.
 * Processes FIFO queue (`ORDER BY reservation_date ASC`), evaluates student flags,
 * and either assigns the copy (Reserved loan) or skips to the next student if flagged.
 *
 * @param {number|string} bookId
 * @param {object} [options]
 * @returns {Promise<{ assigned: boolean, studentId?: number, copyId?: number }|null>}
 */
export async function processNextInReservationQueue(bookId, options = {}) {
  // 1. Fast-Exit (1ms zero overhead check)
  const waitingCount = await Reservation.count({
    where: { book_id: bookId, status: "Waiting" },
  });
  if (waitingCount === 0) {
    return null;
  }

  // 2. Check if an available good copy exists
  const copy = await BookCopy.findOne({
    where: {
      book_id: bookId,
      status: "Available",
      condition_status: "Good",
    },
    order: [["copy_id", "ASC"]],
  });
  if (!copy) {
    return null;
  }

  // 3. Fetch up to 5 waiting reservations in FIFO order
  const waitingReservations = await Reservation.findAll({
    where: { book_id: bookId, status: "Waiting" },
    order: [
      ["reservation_date", "ASC"],
      ["reservation_id", "ASC"],
    ],
    limit: 5,
  });

  // 4. Iterate FIFO queue and evaluate student flags
  for (const resRow of waitingReservations) {
    const candidateUserId = resRow.user_id;

    // Check student eligibility flags
    const eligibility = await checkBorrowEligibility(candidateUserId);
    let flagReason = null;

    if (!eligibility.eligible) {
      flagReason = eligibility.reasons[0]?.message || "Student is ineligible to borrow.";
    } else {
      // Check same-book limit
      const activeLoansForBook = await BorrowedBook.count({
        where: {
          book_id: bookId,
          status: { [Op.in]: ["Reserved", "Borrowed"] },
        },
        include: [
          {
            model: BorrowRequest,
            as: "request",
            where: { user_id: candidateUserId },
            required: true,
          },
        ],
      });

      if (activeLoansForBook >= MAX_COPIES_PER_BOOK) {
        flagReason = `Maximum allowed copies for this title (${MAX_COPIES_PER_BOOK}) already reached.`;
      } else {
        // Check total active library borrows limit
        const totalActiveLoans = await BorrowedBook.count({
          where: {
            status: { [Op.in]: ["Reserved", "Borrowed"] },
          },
          include: [
            {
              model: BorrowRequest,
              as: "request",
              where: { user_id: candidateUserId },
              required: true,
            },
          ],
        });

        if (totalActiveLoans >= MAX_ACTIVE_BORROWS) {
          flagReason = `Maximum allowed active library borrows (${MAX_ACTIVE_BORROWS}) reached.`;
        }
      }
    }

    // If candidate has a flag: Mark Cancelled, record exact reason in remarks, and continue to NEXT candidate!
    if (flagReason) {
      await resRow.update({
        status: "Cancelled",
        closed_at: new Date(),
        remarks: `Skipped: ${flagReason}`,
      });
      console.log(
        `[Reservation Queue] Skipped student ${candidateUserId} for book ${bookId}: ${flagReason}`,
      );
      continue;
    }

    // Candidate has NO flags: Allocate copy, create row in borrowed_books, and mark reservation Ready
    return await withActor(candidateUserId, async (transaction) => {
      // Re-lock available copy inside transaction
      const lockedCopy = await BookCopy.findOne({
        where: {
          copy_id: copy.copy_id,
          status: "Available",
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!lockedCopy) {
        // Copy was taken concurrently
        return null;
      }

      await lockedCopy.update({ status: "Reserved" }, { transaction });

      const pickupDeadline = new Date(
        Date.now() + PICKUP_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      );

      // Create linked Approved borrow_requests row
      const borrowReq = await BorrowRequest.create(
        {
          user_id: candidateUserId,
          book_id: bookId,
          requested_days: 7,
          status: "Approved",
          request_date: new Date(),
          reviewed_by: null,
          reviewed_at: new Date(),
          pickup_deadline: pickupDeadline,
          remarks: "Fulfilled from reservation queue",
        },
        { transaction },
      );

      // Create Reserved row in borrowed_books
      const loan = await BorrowedBook.create(
        {
          request_id: borrowReq.request_id,
          book_id: bookId,
          copy_id: lockedCopy.copy_id,
          status: "Reserved",
          assigned_by: null,
          assigned_at: new Date(),
          due_date: null,
          issued_by: null,
          borrow_date: new Date(),
        },
        { transaction },
      );

      // Update reservation status to Ready
      await resRow.update(
        {
          status: "Ready",
          expires_at: pickupDeadline,
          remarks: `Copy assigned (${lockedCopy.copy_id}). Ready for pickup before deadline.`,
        },
        { transaction },
      );

      try {
        const book = await Book.findByPk(bookId, {
          attributes: ["title"],
          transaction,
        });
        const bookTitle = book?.title || "your reserved title";
        const deadlineStr = formatNoticeDate(pickupDeadline);
        await createNotification({
          userId: candidateUserId,
          type: "RESERVATION_OFFERED",
          title: "A copy is ready",
          message: `A copy of "${bookTitle}" is held for you until ${deadlineStr}.`,
          relatedEntityType: "RESERVATION",
          relatedEntityId: resRow.reservation_id,
          transaction,
        });
      } catch (notifErr) {
        console.warn("[Notification] Error creating RESERVATION_OFFERED notification:", notifErr.message);
      }

      console.log(
        `[Reservation Queue] Assigned copy ${lockedCopy.copy_id} to student ${candidateUserId} for book ${bookId}`,
      );

      return {
        assigned: true,
        studentId: candidateUserId,
        copyId: lockedCopy.copy_id,
        reservationId: resRow.reservation_id,
        borrowId: loan.borrow_id,
        pickupDeadline,
      };
    });
  }

  return null;
}

/**
 * Staff endpoint to view reservation queues across books.
 */
export async function listReservationsStaff(query = {}) {
  const where = {};
  if (query.status && query.status.trim()) {
    where.status = query.status.trim();
  }
  if (query.bookId || query.book_id) {
    where.book_id = query.bookId || query.book_id;
  }

  const reservations = await Reservation.findAll({
    where,
    include: [
      {
        model: Book,
        as: "book",
        attributes: ["book_id", "title", "isbn"],
      },
      {
        model: User,
        as: "student",
        attributes: ["user_id", "first_name", "last_name", "email"],
      },
    ],
    order: [
      ["book_id", "ASC"],
      ["reservation_date", "ASC"],
    ],
  });

  return { reservations };
}

export default {
  createReservation,
  listMyReservations,
  cancelReservation,
  processNextInReservationQueue,
  listReservationsStaff,
  ReservationError,
};
