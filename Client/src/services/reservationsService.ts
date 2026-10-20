import type { CreateReservationRequest, Loan, Reservation, ReservationStatus, StaffReservation, UUID } from "@/types";
import { apiClient } from "@/services/apiClient";
import { USE_MOCKS } from "@/utils/constants";
import { ApiError, fail } from "@/utils/errors";
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
  recordAttempt,
  releaseCopy,
  studentName,
  studentRef,
  studentUserId,
  toLoan,
  toReservation,
} from "./mockEngine";
import { audit, commit, db, matches, newId, notify, nowIso, out, requireCapability, requireStudent } from "./mockStore";

type BackendRow = Record<string, unknown>;

function backendRow(value: unknown): BackendRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("UNKNOWN", "The Server returned an invalid reservation response.");
  }
  return value as BackendRow;
}

function reservationStatus(value: unknown): ReservationStatus {
  const normalized = typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "_") : "";
  const statuses: Record<string, ReservationStatus> = {
    WAITING: "WAITING",
    READY: "OFFERED",
    OFFERED: "OFFERED",
    COLLECTED: "COLLECTED",
    EXPIRED: "EXPIRED",
    CANCELLED: "CANCELLED",
  };
  const status = statuses[normalized];
  if (!status) throw new ApiError("UNKNOWN", `The Server returned an unsupported reservation status: ${String(value)}.`);
  return status;
}

function backendDuration(value: unknown): number | null {
  const duration = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(duration) && duration > 0 ? duration : null;
}

function mapBackendReservation(value: unknown, requestedDurationDays?: number): Reservation {
  const row = backendRow(value);
  const book = row.book && typeof row.book === "object" ? row.book as BackendRow : null;
  const remarks = typeof row.remarks === "string" ? row.remarks : "";
  const durationFromRemarks = remarks.match(/requested loan duration:\s*(\d+)\s*days/i)?.[1];
  return {
    id: String(row.id ?? row.reservationId ?? row.reservation_id),
    bookId: String(row.bookId ?? row.book_id ?? book?.book_id ?? ""),
    bookTitle: String(row.bookTitle ?? book?.title ?? "Unknown title"),
    requestedDurationDays: requestedDurationDays ?? backendDuration(row.requestedDurationDays ?? row.requested_days ?? durationFromRemarks),
    status: reservationStatus(row.status),
    reservedAt: String(row.reservedAt ?? row.reservation_date ?? ""),
    pickupDeadline: row.pickupDeadline == null && row.expires_at == null
      ? null
      : String(row.pickupDeadline ?? row.expires_at),
    queuePosition: row.queuePosition == null ? undefined : Number(row.queuePosition),
    offeredCopyId: row.offeredCopyId == null ? null : String(row.offeredCopyId),
  };
}

function positiveIntegerId(value: UUID, label: string): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    fail("VALIDATION_ERROR", `${label} must be a positive integer.`, 400);
  }
  return Number(value);
}

// Reservation eligibility, queue position, and copy assignment remain server decisions in live mode.
// Reservations exist only when no copy is available. The queue is FIFO by reservedAt, then id.
// Offers, expiry and queue order are decided by the BACKEND; mockEngine simulates them.

/** B4 POST /reservations. Allowed only when no copy is available (else 409 COPY_AVAILABLE). */
export async function createReservation(req: CreateReservationRequest): Promise<Reservation> {
  if (!USE_MOCKS) {
    const bookId = positiveIntegerId(req.bookId, "Book id");
    const response = backendRow((await apiClient.post("/reservations", {
      book_id: bookId,
      requested_days: req.requestedDurationDays,
    })).data);
    return mapBackendReservation(response.reservation, req.requestedDurationDays);
  }
  await begin();
  const { account, student } = requireStudent();
  const book = db.books.find((b) => b.id === req.bookId && !b.isArchived);
  if (!book) fail("NOT_FOUND", "We could not find that book.");
  const durationError = validateDuration(req.requestedDurationDays);
  if (durationError) fail("INVALID_DURATION", durationError, 422);
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
    requestedDurationDays: req.requestedDurationDays,
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
  if (!USE_MOCKS) {
    const response = backendRow((await apiClient.get("/reservations/mine")).data);
    const rows = Array.isArray(response.reservations) ? response.reservations : [];
    const reservations = rows.map((row) => mapBackendReservation(row));
    return params.status ? reservations.filter((reservation) => reservation.status === params.status) : reservations;
  }
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
  if (!USE_MOCKS) {
    const id = positiveIntegerId(reservationId, "Reservation id");
    await apiClient.post(`/reservations/${id}/cancel`);
    const updated = (await listMyReservations()).find((reservation) => reservation.id === String(id));
    if (!updated) throw new ApiError("UNKNOWN", "The Server cancelled the reservation but it was not present in the refreshed reservation list.");
    return updated;
  }
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
  if (!USE_MOCKS) {
    const response = backendRow((await apiClient.get("/reservations")).data);
    const rows = Array.isArray(response.reservations) ? response.reservations : [];
    const mapped = rows.map((value): StaffReservation => {
      const row = backendRow(value);
      const student = row.student && typeof row.student === "object" ? row.student as BackendRow : {};
      const user = row.user && typeof row.user === "object" ? row.user as BackendRow : student;
      const reservation = mapBackendReservation(row);
      const name = String(student.name ?? `${user.first_name ?? ""} ${user.last_name ?? ""}`).trim();
      return {
        ...reservation,
        student: {
          id: String(student.id ?? student.user_id ?? row.user_id ?? ""),
          studentNumber: String(student.studentNumber ?? student.student_number ?? ""),
          firstName: String(student.firstName ?? user.first_name ?? name.split(" ")[0] ?? ""),
          lastName: String(student.lastName ?? user.last_name ?? name.split(" ").slice(1).join(" ")),
        },
        queuePosition: Number(row.queuePosition ?? 0),
        offeredCopy: null,
      };
    });
    const ordered = [...mapped].sort((a, b) =>
      a.bookId.localeCompare(b.bookId) || a.reservedAt.localeCompare(b.reservedAt),
    );
    const positions = new Map<string, number>();
    ordered.forEach((reservation) => {
      if (reservation.status !== "WAITING") return;
      const position = (positions.get(reservation.bookId) ?? 0) + 1;
      positions.set(reservation.bookId, position);
      reservation.queuePosition = position;
    });
    return ordered
      .filter((reservation) => !params.status || reservation.status === params.status)
      .filter((reservation) => !params.search || matches(
        params.search,
        reservation.bookTitle,
        reservation.student.firstName,
        reservation.student.lastName,
        reservation.student.studentNumber,
      ))
      .sort((a, b) => a.bookTitle.localeCompare(b.bookTitle) || a.reservedAt.localeCompare(b.reservedAt));
  }
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
 * P6 POST /staff/reservations/:id/claim (proposed): issue an OFFERED reservation from Books to Release.
 * The selected duration is stored with the reservation and starts on the actual issuance date.
 */
export async function claimReservation(reservationId: UUID): Promise<Loan> {
  await begin();
  const staff = requireCapability("STAFF_AREA");
  const reservation = db.reservations.find((r) => r.id === reservationId);
  if (!reservation) fail("NOT_FOUND", "We could not find that reservation.");
  if (reservation.status !== "OFFERED" || isPast(reservation.pickupDeadline)) fail("INVALID_STATE", "This offer is no longer available.", 409);
  const copy = reservation.offeredCopyId ? copyById(reservation.offeredCopyId) : undefined;
  if (!copy) fail("INVALID_STATE", "The offered copy could not be found.", 409);
  const competingAssignment =
    db.requests.some((r) => r.assignedCopyId === copy.id && (r.status === "APPROVED" || r.status === "ON_HOLD")) ||
    db.reservations.some((r) => r.id !== reservation.id && r.offeredCopyId === copy.id && r.status === "OFFERED");
  if (copy.status !== "RESERVED" || competingAssignment || copy.condition === "DAMAGED" || copy.condition === "UNUSABLE") {
    fail("INVALID_STATE", "The offered copy is no longer available for this reservation.", 409);
  }
  const check = checkEligibility(reservation.studentId);
  if (!check.eligible) {
    audit(staff, "HANDOVER_CLAIM_FAILED", "RESERVATION", reservation.id, `Handover of ${reservation.bookTitle} to ${studentName(reservation.studentId)} failed: ${check.reasons[0].message}`);
    commit();
    fail("ELIGIBILITY_FAILED", check.reasons[0].message, 403, { reasons: check.reasons });
  }
  if (reservation.requestedDurationDays === null) {
    fail("INVALID_STATE", "The requested loan duration is not available.", 409);
  }
  const loan = createLoan(reservation.studentId, copy, reservation.bookTitle, reservation.requestedDurationDays);
  reservation.status = "COLLECTED";
  recordAttempt(reservation.id, "CLAIMED", staff, null, null);
  notify(studentUserId(reservation.studentId), "LOAN_ISSUED", "Book issued", `You borrowed ${reservation.bookTitle}.`, ["LOAN", loan.id]);
  audit(staff, "RESERVATION_CLAIMED", "RESERVATION", reservation.id, `Handed over ${reservation.bookTitle} to ${studentName(reservation.studentId)} from a reservation.`);
  commit();
  return out(toLoan(loan));
}