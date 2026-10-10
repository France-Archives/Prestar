// Server/services/borrowRequestService.js
import { Op, QueryTypes, UniqueConstraintError } from "sequelize";
import {
  Author,
  Book,
  BookCopy,
  BorrowedBook,
  BorrowRequest,
  Category,
  Penalty,
  Reservation,
  sequelize,
  Suspension,
  User,
} from "../models/index.js";
import {
  BLOCK_ON_ANY_UNPAID_PENALTY,
  BORROWABLE_COPY_WHERE,
  LOAN_PERIOD_DAYS,
  MAX_ACTIVE_BORROWS,
  MAX_COPIES_PER_BOOK,
  PICKUP_WINDOW_DAYS,
} from "../config/libraryRules.js";

export class BorrowRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "BorrowRequestError";
    this.status = status;
  }
}

async function notify(_userId, _type, _message, _requestId, _transaction) {
  return null;
}

async function releaseReservedCopy(request, transaction) {
  if (!request.copy_id) return;
  await BookCopy.update({ status: "Available" }, {
    where: { copy_id: request.copy_id, status: "Reserved" },
    transaction,
  });
  request.copy_id = null;
}

export async function expirePickupRequests() {
  const now = new Date();
  return sequelize.transaction(async (transaction) => {
    const expired = await BorrowRequest.findAll({
      where: { status: "Approved", pickup_deadline: { [Op.lte]: now } },
      attributes: ["request_id", "user_id", "copy_id"],
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
    });

    for (const request of expired) {
      await releaseReservedCopy(request, transaction);
      await request.update({ status: "Expired", copy_id: null }, { transaction });
      await notify(request.user_id, "BORROW_REQUEST_EXPIRED", "Your approved book request expired because it was not picked up before the deadline.", request.request_id, transaction);
    }
    return expired.length;
  });
}

export async function createBorrowRequest(userId, bookId) {
  await expirePickupRequests();
  try {
    return await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(userId, {
        attributes: ["id", "status"],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!user || user.status !== "Active") {
        throw new BorrowRequestError(403, "Your account is not active.");
      }

      const book = await Book.findOne({
        where: { book_id: bookId, status: "Active" },
        attributes: ["book_id"],
        transaction,
      });
      if (!book) throw new BorrowRequestError(404, "Active book not found.");

      const activeReservation = await Reservation.findOne({
        where: { user_id: userId, book_id: bookId, status: { [Op.in]: ["Waiting", "Ready"] } },
        attributes: ["reservation_id", "status"],
        transaction,
      });
      if (activeReservation) {
        throw new BorrowRequestError(403, "You already have an active reservation for this book.");
      }

      const available = await BookCopy.count({
        where: { book_id: bookId, ...BORROWABLE_COPY_WHERE },
        transaction,
      });
      if (available === 0) throw new BorrowRequestError(409, "No copies are currently available. Use the reservation flow.");

      const suspended = await Suspension.findOne({
        where: {
          user_id: userId,
          status: "Active",
          start_date: { [Op.lte]: sequelize.literal("CURRENT_DATE") },
          [Op.or]: [
            { end_date: { [Op.is]: null } },
            { end_date: { [Op.gte]: sequelize.literal("CURRENT_DATE") } },
          ],
        },
        attributes: ["suspension_id"],
        transaction,
      });
      if (suspended) throw new BorrowRequestError(403, "Borrowing is blocked while your account has an active suspension.");

      if (BLOCK_ON_ANY_UNPAID_PENALTY) {
        const unpaidPenalty = await Penalty.findOne({
          where: { user_id: userId, status: "Unpaid" },
          attributes: ["penalty_id"],
          transaction,
        });
        if (unpaidPenalty) throw new BorrowRequestError(403, "Borrowing is blocked while you have an unpaid penalty.");
      }

      const overdue = await sequelize.query(
        "SELECT 1 FROM public.borrowed_books WHERE user_id = :userId AND status = 'Borrowed' AND due_date < CURRENT_DATE LIMIT 1",
        { replacements: { userId }, type: QueryTypes.SELECT, transaction },
      );
      if (overdue.length) throw new BorrowRequestError(403, "Borrowing is blocked because you have an overdue book.");

      const duplicateRequest = await BorrowRequest.findOne({
        where: { user_id: userId, book_id: bookId, status: { [Op.in]: ["Pending", "Approved"] } },
        attributes: ["request_id"],
        transaction,
      });
      if (duplicateRequest) throw new BorrowRequestError(403, "You already have a pending or approved request for this book.");

      const activeLoansForBook = await BorrowedBook.count({
        where: { user_id: userId, book_id: bookId, status: "Borrowed" },
        transaction,
      });
      const openRequestsForBook = await BorrowRequest.count({
        where: { user_id: userId, book_id: bookId, status: { [Op.in]: ["Pending", "Approved"] } },
        transaction,
      });
      if (activeLoansForBook + openRequestsForBook >= MAX_COPIES_PER_BOOK) {
        throw new BorrowRequestError(
          403,
          `You already have ${MAX_COPIES_PER_BOOK} active loans or requests for this book, which is the maximum allowed per title.`
        );
      }

      const activeBorrows = await BorrowedBook.count({ where: { user_id: userId, status: "Borrowed" }, transaction });
      const openRequests = await BorrowRequest.count({ where: { user_id: userId, status: { [Op.in]: ["Pending", "Approved"] } }, transaction });
      if (activeBorrows + openRequests >= MAX_ACTIVE_BORROWS) {
        throw new BorrowRequestError(403, `You already have ${MAX_ACTIVE_BORROWS} active book loans or requests, which is the maximum allowed.`);
      }

      const request = await BorrowRequest.create({ user_id: userId, book_id: bookId, status: "Pending" }, { transaction });
      return request;
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError || error?.original?.code === "23505") {
      throw new BorrowRequestError(403, "You already have a pending or approved request for this book.");
    }
    throw error;
  }
}

const requestIncludes = [
  { model: User, as: "student", attributes: ["id", "student_id", "first_name", "last_name", "email"] },
  {
    model: Book,
    as: "book",
    attributes: ["book_id", "title", "isbn", "publisher"],
    include: [
      { model: Author, as: "author", attributes: ["author_id", "first_name", "last_name"] },
      { model: Category, as: "category", attributes: ["category_id", "category_name"] },
    ],
  },
  { model: BookCopy, as: "copy", attributes: ["copy_id", "accession_no", "shelf_location", "status"], required: false },
];

export async function listBorrowRequests({ status, userId }) {
  await expirePickupRequests();
  const where = {};
  if (status) where.status = status;
  if (userId) where.user_id = userId;
  return BorrowRequest.findAll({ where, include: requestIncludes, order: [["request_date", "DESC"], ["request_id", "DESC"]] });
}

export async function reviewBorrowRequest(requestId, reviewerId, decision, remarks) {
  await expirePickupRequests();
  return sequelize.transaction(async (transaction) => {
    const request = await BorrowRequest.findByPk(requestId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!request) throw new BorrowRequestError(404, "Borrow request not found.");
    if (request.status !== "Pending") throw new BorrowRequestError(409, "Only pending requests can be reviewed.");

    const reviewer = await User.findByPk(reviewerId, { attributes: ["id", "status"], transaction });
    if (!reviewer || reviewer.status !== "Active") throw new BorrowRequestError(403, "Reviewer account is not active.");

    if (decision === "reject") {
      await releaseReservedCopy(request, transaction);
      await request.update({ status: "Rejected", reviewed_by: reviewerId, reviewed_at: new Date(), remarks: remarks.trim(), copy_id: null }, { transaction });
      await notify(request.user_id, "BORROW_REQUEST_REJECTED", `Your request to borrow this book was rejected: ${remarks.trim()}`, request.request_id, transaction);
      return request;
    }

    const copy = await BookCopy.findOne({
      where: { book_id: request.book_id, ...BORROWABLE_COPY_WHERE },
      order: [["copy_id", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
    });
    if (!copy) throw new BorrowRequestError(409, "No good copy is currently available to assign.");

    const [updatedCopies] = await BookCopy.update({ status: "Reserved" }, {
      where: { copy_id: copy.copy_id, ...BORROWABLE_COPY_WHERE },
      transaction,
    });
    if (!updatedCopies) throw new BorrowRequestError(409, "No good copy is currently available to assign.");

    const pickupDeadline = new Date(Date.now() + PICKUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    await request.update({
      status: "Approved",
      copy_id: copy.copy_id,
      reviewed_by: reviewerId,
      reviewed_at: new Date(),
      pickup_deadline: pickupDeadline,
      remarks: remarks?.trim() || null,
    }, { transaction });
    await notify(request.user_id, "BORROW_REQUEST_APPROVED", `Your book request was approved. Pick up the book by ${pickupDeadline.toISOString()}.`, request.request_id, transaction);
    return request;
  });
}

function addCalendarDays(dateText, days) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export async function confirmBorrowPickup(requestId, issuerId) {
  await expirePickupRequests();
  const result = await sequelize.transaction(async (transaction) => {
    const request = await BorrowRequest.findByPk(requestId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!request) throw new BorrowRequestError(404, "Borrow request not found.");

    const student = await User.findByPk(request.user_id, {
      attributes: ["id", "status"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!student || student.status !== "Active") throw new BorrowRequestError(403, "Student account is not active.");

    if (request.status !== "Approved") throw new BorrowRequestError(409, "Only approved requests can be issued.");
    if (!request.pickup_deadline || new Date(request.pickup_deadline) <= new Date()) {
      await releaseReservedCopy(request, transaction);
      await request.update({ status: "Expired", copy_id: null }, { transaction });
      await notify(request.user_id, "BORROW_REQUEST_EXPIRED", "Your approved book request expired because it was not picked up before the deadline.", request.request_id, transaction);
      return { expired: true };
    }
    if (!request.copy_id) throw new BorrowRequestError(409, "No copy is assigned to this request.");

    const issuer = await User.findByPk(issuerId, { attributes: ["id", "status"], transaction });
    if (!issuer || issuer.status !== "Active") throw new BorrowRequestError(403, "Librarian account is not active.");

    const activeBorrows = await BorrowedBook.count({
      where: { user_id: request.user_id, status: "Borrowed" },
      transaction,
    });
    if (activeBorrows >= MAX_ACTIVE_BORROWS) {
      throw new BorrowRequestError(403, `You already have ${MAX_ACTIVE_BORROWS} active book loans, which is the maximum allowed.`);
    }

    const activeLoansForBook = await BorrowedBook.count({
      where: { user_id: request.user_id, book_id: request.book_id, status: "Borrowed" },
      transaction,
    });
    if (activeLoansForBook >= MAX_COPIES_PER_BOOK) {
      throw new BorrowRequestError(
        403,
        `You already have ${MAX_COPIES_PER_BOOK} active loans for this book, which is the maximum allowed per title.`
      );
    }

    const [todayRow] = await sequelize.query("SELECT CURRENT_DATE::text AS today", { type: QueryTypes.SELECT, transaction });
    const borrowDate = new Date();
    const dueDate = addCalendarDays(todayRow.today, LOAN_PERIOD_DAYS);
    const [updatedCopies] = await BookCopy.update({ status: "Borrowed" }, {
      where: { copy_id: request.copy_id, status: "Reserved" },
      transaction,
    });
    if (!updatedCopies) throw new BorrowRequestError(409, "The assigned copy is no longer reserved for this request.");

    const borrow = await BorrowedBook.create({
      request_id: request.request_id,
      reservation_id: null,
      user_id: request.user_id,
      book_id: request.book_id,
      copy_id: request.copy_id,
      borrow_date: borrowDate,
      due_date: dueDate,
      renewal_count: 0,
      status: "Borrowed",
      issued_by: issuerId,
    }, { transaction });
    await request.update({ status: "Issued" }, { transaction });
    await notify(request.user_id, "BOOK_ISSUED", `Your book has been issued. It is due on ${dueDate}.`, request.request_id, transaction);
    return { borrow };
  });
  if (result.expired) throw new BorrowRequestError(409, "The pickup deadline has passed; this request expired.");
  return result.borrow;
}

export async function cancelBorrowRequest(requestId, userId) {
  await expirePickupRequests();
  return sequelize.transaction(async (transaction) => {
    const request = await BorrowRequest.findByPk(requestId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!request || String(request.user_id) !== String(userId)) {
      throw new BorrowRequestError(404, "Borrow request not found.");
    }
    if (!["Pending", "Approved"].includes(request.status)) {
      throw new BorrowRequestError(409, "Only pending or approved requests can be cancelled.");
    }

    await releaseReservedCopy(request, transaction);
    await request.update({ status: "Cancelled", copy_id: null }, { transaction });
    await notify(request.user_id, "BORROW_REQUEST_CANCELLED", "Your borrow request was cancelled.", request.request_id, transaction);
    return request;
  });
}
