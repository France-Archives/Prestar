import type { CreateReservationRequest, Loan, Reservation, ReservationStatus, StaffReservation, UUID, AllowedDurationDays, ClaimRequest } from "@/types";
import { fail } from "@/utils/errors";
import { isPast } from "@/utils/formatDate";
import { validateDuration } from "@/utils/validators";
import {
  assertEligible,
  begin,
  checkEligibility,
  copyById,
  copyRef,
  createLoan,
  queuePosition,
  releaseCopy,
  studentName,
  studentRef,
  studentUserId,
  toLoan,
  toReservation,
} from "./mockEngine";
import { audit, commit, db, matches, newId, notify, nowIso, out, requireCapability, requireStudent } from "./mockStore";

// TEMPORARY MOCK IMPLEMENTATION: Replace with the real reservation API (B4, B5, P5 to P7).
// Reservations exist only when no copy is available. The queue is FIFO by reservedAt, then id.
// Offers, expiry and queue order are decided by the BACKEND; mockEngine simulates them.

/** B4 POST /reservations. Allowed only when no copy is available (else 409 COPY_AVAILABLE). */
export async function createReservation(req: CreateReservationRequest): Promise<Reservation> {
  await begin();
  const { account, student } = requireStudent();
  const book = db.books.find((b) => b.id === req.bookId && !b.isArchived);
  if (!book) fail("NOT_FOUND", "We could not find that book.");
  assertEligible(student.id, { includeLimits: true, bookId: book.id });
  if (db.copies.some((c) => c.bookId === book.id && c.status === "AVAILABLE")) fail("COPY_AVAILABLE", undefined, 409);
  if (db.reservations.some((r) => r.studentId === student.id && r.bookId === book.id && (r.status === "WAITING" || r.status === "OFFERED"))) {
    fail("CONFLICT", "You are already in the reservation queue for this book.");
  }
  const reservation = {
    id: newId(),
    studentId: student.id,
    bookId: book.id,
    bookTitle: book.title,
    status: "WAITING" as const,
    reservedAt: nowIso(),
    pickupDeadline: null,
    offeredCopyId: null,
  };
  db.reservations.push(reservation);
  notify(account.user.id, "RESERVATION_CONFIRMED", "Reservation confirmed", `You are in the reservation queue for ${book.title}. We will notify you when a copy is offered.`, ["RESERVATION", reservation.id]);
  commit();
  return out(toReservation(reservation));
}

/** B5 GET /me/reservations */
export async function listMyReservations(params: { status?: ReservationStatus } = {}): Promise<Reservation[]> {
  await begin();
  const { student } = requireStudent();
  return out(
    db.reservations
      .filter((r) => r.studentId === student.id && (!params.status || r.status === params.status))
      .sort((a, b) => b.reservedAt.localeCompare(a.reservedAt))
      .map(toReservation),
  );
}

/** P7 POST /reservations/:id/cancel (proposed). Cancelling an OFFERED reservation passes the copy on. */
export async function cancelMyReservation(reservationId: UUID): Promise<Reservation> {
  await begin();
  const { student } = requireStudent();
  const reservation = db.reservations.find((r) => r.id === reservationId && r.studentId === student.id);
  if (!reservation) fail("NOT_FOUND", "We could not find that reservation.");
  if (reservation.status !== "WAITING" && reservation.status !== "OFFERED") fail("INVALID_STATE", "This reservation can no longer be cancelled.", 409);
  const copy = reservation.status === "OFFERED" && reservation.offeredCopyId ? copyById(reservation.offeredCopyId) : undefined;
  reservation.status = "CANCELLED";
  if (copy && copy.status === "RESERVED") releaseCopy(copy);
  commit();
  return out(toReservation(reservation));
}

// ---------- staff (Librarian + Admin) ----------

/** P5 GET /staff/reservations (proposed) */
export async function listStaffReservations(params: { status?: ReservationStatus; search?: string } = {}): Promise<StaffReservation[]> {
  await begin();
  requireCapability("STAFF_AREA");
  const rows = db.reservations
    .filter((r) => !params.status || r.status === params.status)
    .filter((r) => matches(params.search, r.bookTitle, studentName(r.studentId), studentRef(r.studentId).studentNumber))
    .sort((a, b) => a.bookTitle.localeCompare(b.bookTitle) || a.reservedAt.localeCompare(b.reservedAt))
    .map((r): StaffReservation => {
      const copy = r.offeredCopyId ? copyById(r.offeredCopyId) : undefined;
      const { studentId: _studentId, ...base } = r;
      return { ...base, student: studentRef(r.studentId), queuePosition: r.status === "WAITING" ? queuePosition(r) : 0, offeredCopy: copy ? copyRef(copy) : null };
    });
  return out(rows);
}

/**
 * P6 POST /staff/reservations/:id/claim (proposed): hand over an OFFERED reservation.
 * The loan duration source is TO CONFIRM (TC-12; reservations have no duration column), so staff choose it here.
 */
export async function claimReservation(reservationId: UUID, req: ClaimRequest & { durationDays: AllowedDurationDays }): Promise<Loan> {
  await begin();
  const staff = requireCapability("STAFF_AREA");
  const reservation = db.reservations.find((r) => r.id === reservationId);
  if (!reservation) fail("NOT_FOUND", "We could not find that reservation.");
  if (reservation.status !== "OFFERED" || isPast(reservation.pickupDeadline)) fail("INVALID_STATE", "This offer is no longer available.", 409);
  const durationError = validateDuration(req.durationDays);
  if (durationError) fail("INVALID_DURATION", durationError, 422);
  const copy = reservation.offeredCopyId ? copyById(reservation.offeredCopyId) : undefined;
  if (!copy) fail("INVALID_STATE", "The offered copy could not be found.", 409);
  if (copy.barcode !== req.copyBarcode.trim()) fail("VALIDATION_ERROR", "The barcode does not match the offered copy.", 422);
  const check = checkEligibility(reservation.studentId);
  if (!check.eligible) {
    audit(staff, "HANDOVER_CLAIM_FAILED", "RESERVATION", reservation.id, `Handover of ${reservation.bookTitle} to ${studentName(reservation.studentId)} failed: ${check.reasons[0].message}`);
    commit();
    fail("ELIGIBILITY_FAILED", check.reasons[0].message, 403, { reasons: check.reasons });
  }
  const loan = createLoan(reservation.studentId, copy, reservation.bookTitle, req.durationDays);
  reservation.status = "COLLECTED";
  notify(studentUserId(reservation.studentId), "LOAN_ISSUED", "Book issued", `You borrowed ${reservation.bookTitle}.`, ["LOAN", loan.id]);
  audit(staff, "RESERVATION_CLAIMED", "RESERVATION", reservation.id, `Handed over ${reservation.bookTitle} to ${studentName(reservation.studentId)} from a reservation.`);
  commit();
  return out(toLoan(loan));
}