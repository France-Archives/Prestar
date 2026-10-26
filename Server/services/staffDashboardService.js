// Server/services/staffDashboardService.js
import { Op, QueryTypes } from "sequelize";
import {
  Book,
  BookCopy,
  BorrowedBook,
  BorrowRequest,
  Reservation,
  Student,
  StudentVerification,
  User,
  sequelize,
} from "../models/index.js";

const toId = (value) => String(value);

function studentRef(user, student) {
  return {
    id: toId(user.user_id),
    studentNumber: student?.student_number ?? "",
    firstName: user.first_name,
    lastName: user.last_name,
  };
}

function copyRef(copy) {
  if (!copy) return null;
  return {
    id: toId(copy.copy_id),
    barcode: copy.accession_no,
  };
}

function overdueDays(dueDateValue) {
  if (!dueDateValue) return 0;
  const due = new Date(dueDateValue);
  const now = new Date();
  // Zero-out time to compare calendar days
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((now - due) / (24 * 60 * 60 * 1000));
  return diff > 0 ? diff : 0;
}

/**
 * Returns books awaiting release (approved / on-hold borrow requests and ready reservations)
 */
export async function getBooksToReleaseList({ search = "" } = {}) {
  // 1) Books to release: Approved / On Hold borrow requests
  const approvedRequests = await BorrowRequest.findAll({
    where: {
      status: { [Op.in]: ["Approved", "On Hold"] },
    },
    include: [
      {
        model: Book,
        as: "book",
        attributes: ["book_id", "title"],
      },
      {
        model: Student,
        as: "student",
        attributes: ["user_id", "student_number"],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["user_id", "first_name", "last_name"],
          },
        ],
      },
    ],
    order: [["pickup_deadline", "ASC"]],
  });

  const requestIds = approvedRequests.map((r) => r.request_id);
  const borrowedBooks = requestIds.length > 0
    ? await BorrowedBook.findAll({
        where: { request_id: { [Op.in]: requestIds }, status: "Reserved" },
        include: [{ model: BookCopy, as: "copy", attributes: ["copy_id", "accession_no", "shelf_location"] }],
      })
    : [];
  const borrowedByRequestId = new Map(borrowedBooks.map((bb) => [String(bb.request_id), bb]));

  const booksToRelease = approvedRequests.map((r) => {
    const bb = borrowedByRequestId.get(String(r.request_id));
    const copy = bb?.copy;
    return {
      requestId: toId(r.request_id),
      reservationId: null,
      student: studentRef(r.student?.user ?? {}, r.student),
      book: { id: toId(r.book_id), title: r.book?.title ?? "" },
      copy: copy
        ? {
            id: toId(copy.copy_id),
            barcode: copy.accession_no,
            section: null,
            shelfCode: null,
            levelOrRow: null,
            locationNotes: null,
            shelfLocation: copy.shelf_location ?? null,
          }
        : { id: "", barcode: "", section: null, shelfCode: null, levelOrRow: null, locationNotes: null, shelfLocation: null },
      requestedDurationDays: r.requested_days ?? null,
      approvedAt: r.reviewed_at,
      pickupDeadline: r.pickup_deadline,
      status: r.status === "On Hold" ? "ON_HOLD" : "APPROVED",
    };
  });

  // 2) Offered reservations with "Ready" status
  const offeredReservations = await Reservation.findAll({
    where: { status: "Ready" },
    include: [
      { model: Book, as: "book", attributes: ["book_id", "title"] },
      {
        model: User,
        as: "student",
        attributes: ["user_id", "first_name", "last_name"],
        include: [{ model: Student, as: "student", attributes: ["user_id", "student_number"] }],
      },
    ],
    order: [["reservation_date", "ASC"]],
  });

  for (const r of offeredReservations) {
    booksToRelease.push({
      requestId: "",
      reservationId: toId(r.reservation_id),
      student: {
        id: toId(r.student?.user_id ?? ""),
        studentNumber: r.student?.student?.student_number ?? "",
        firstName: r.student?.first_name ?? "",
        lastName: r.student?.last_name ?? "",
      },
      book: { id: toId(r.book_id), title: r.book?.title ?? "" },
      copy: { id: "", barcode: "", section: null, shelfCode: null, levelOrRow: null, locationNotes: null, shelfLocation: null },
      requestedDurationDays: null,
      approvedAt: null,
      pickupDeadline: r.expires_at,
      status: "OFFERED",
    });
  }

  booksToRelease.sort((a, b) => {
    const da = a.pickupDeadline ?? "";
    const db = b.pickupDeadline ?? "";
    return da.localeCompare(db);
  });

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    return booksToRelease.filter((b) => {
      const matchTitle = b.book?.title?.toLowerCase().includes(q);
      const matchFn = b.student?.firstName?.toLowerCase().includes(q);
      const matchLn = b.student?.lastName?.toLowerCase().includes(q);
      const matchSn = b.student?.studentNumber?.toLowerCase().includes(q);
      const matchBc = b.copy?.barcode?.toLowerCase().includes(q);
      return matchTitle || matchFn || matchLn || matchSn || matchBc;
    });
  }

  return booksToRelease;
}

/**
 * GET /staff/dashboard
 * Returns the data needed by the LibrarianDashboardPage / CirculationStats components.
 */
export async function getStaffDashboardData(userId) {
  // Verify user is staff
  const user = await User.findByPk(userId, {
    attributes: ["user_id", "role", "status"],
  });
  if (!user || !["Librarian", "Admin"].includes(user.role)) {
    const error = new Error("Staff access required.");
    error.status = 403;
    throw error;
  }

  const canReviewCor = user.role === "Admin" || user.role === "Librarian";

  // 1) Books to release: Approved / On Hold borrow requests + Offered reservations
  const booksToRelease = await getBooksToReleaseList();

  // 2) Offered reservations with "Ready" status
  const offeredReservations = await Reservation.findAll({
    where: { status: "Ready" },
    include: [
      { model: Book, as: "book", attributes: ["book_id", "title"] },
      {
        model: User,
        as: "student",
        attributes: ["user_id", "first_name", "last_name"],
        include: [{ model: Student, as: "student", attributes: ["user_id", "student_number"] }],
      },
    ],
    order: [["reservation_date", "ASC"]],
  });

  const offeredReservationEntries = offeredReservations.map((r, index) => ({
    id: toId(r.reservation_id),
    bookId: toId(r.book_id),
    bookTitle: r.book?.title ?? "",
    requestedDurationDays: null,
    status: "OFFERED",
    reservedAt: r.reservation_date,
    pickupDeadline: r.expires_at,
    queuePosition: index + 1,
    offeredCopyId: null,
    student: {
      id: toId(r.student?.user_id ?? ""),
      studentNumber: r.student?.student?.student_number ?? "",
      firstName: r.student?.first_name ?? "",
      lastName: r.student?.last_name ?? "",
    },
    offeredCopy: null,
  }));

  // 3) Overdue loans: active borrowed books past due date
  const overdueLoans = await sequelize.query(
    `SELECT
       bb.borrow_id,
       bb.book_id,
       bb.copy_id,
       bb.borrow_date,
       bb.due_date,
       bb.status,
       b.title AS book_title,
       bc.accession_no,
       u.user_id,
       u.first_name,
       u.last_name,
       s.student_number
     FROM borrowed_books bb
     JOIN borrow_requests br ON br.request_id = bb.request_id
     JOIN users u ON u.user_id = br.user_id
     LEFT JOIN students s ON s.user_id = u.user_id
     JOIN books b ON b.book_id = bb.book_id
     LEFT JOIN book_copies bc ON bc.copy_id = bb.copy_id
     WHERE bb.status = 'Borrowed'
       AND bb.due_date < CURRENT_DATE
     ORDER BY bb.due_date ASC`,
    { type: QueryTypes.SELECT },
  );

  const formattedOverdueLoans = overdueLoans.map((row) => ({
    id: toId(row.borrow_id),
    bookId: toId(row.book_id),
    bookTitle: row.book_title ?? "",
    copyId: toId(row.copy_id),
    copyBarcode: row.accession_no ?? "",
    status: "ACTIVE",
    borrowedAt: row.borrow_date,
    dueAt: row.due_date,
    returnedAt: null,
    renewedCount: 0,
    student: {
      id: toId(row.user_id),
      studentNumber: row.student_number ?? "",
      firstName: row.first_name ?? "",
      lastName: row.last_name ?? "",
    },
    overdueDays: overdueDays(row.due_date),
  }));

  // Sort by overdue days descending
  formattedOverdueLoans.sort((a, b) => b.overdueDays - a.overdueDays);

  // 4) Counts
  const awaitingRelease = booksToRelease.filter((b) => b.status === "APPROVED" || b.status === "OFFERED").length;
  const onHold = booksToRelease.filter((b) => b.status === "ON_HOLD").length;
  const pendingCorReviews = canReviewCor
    ? await StudentVerification.count({ where: { status: "Pending" } })
    : null;

  // 5) Pickups due soon: within 1 day
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const pickupsDueSoon = booksToRelease.filter((b) => {
    if (b.status !== "APPROVED" && b.status !== "OFFERED") return false;
    if (!b.pickupDeadline) return false;
    return new Date(b.pickupDeadline) <= tomorrow;
  });

  return {
    booksToRelease,
    awaitingRelease,
    onHold,
    pendingCorReviews,
    overdueLoans: formattedOverdueLoans,
    offeredReservations: offeredReservationEntries,
    pickupsDueSoon,
  };
}
