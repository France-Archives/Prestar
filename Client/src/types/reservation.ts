import type { ISODateTime, UUID } from "./api";
import type { AllowedDurationDays, ReservationStatus } from "./enums";
import type { CopyRef } from "./book";
import type { StudentRef } from "./user";

export interface ReservationCancellation {
  message: string;
  reservationId: UUID;
  status: Extract<ReservationStatus, "CANCELLED">;
}

// reservations -> Reservation
export interface Reservation {
  id: UUID;
  bookId: UUID;
  bookTitle: string;
  requestedDurationDays: number | null;
  status: ReservationStatus;
  reservedAt: ISODateTime;
  pickupDeadline: ISODateTime | null; // set when OFFERED
  queuePosition?: number; // computed, FIFO by reservedAt then id
  offeredCopyId?: UUID | null;
}

/** GET /reservations for Librarians and Admins. */
export interface StaffReservation extends Reservation {
  student: Omit<StudentRef, "studentNumber"> & { studentNumber: string | null };
  queuePosition: number;
  offeredCopy: CopyRef | null;
}

/** POST /reservations. Allowed only when no copy is available (else 409 COPY_AVAILABLE). */
export interface CreateReservationRequest {
  bookId: UUID;
  requestedDurationDays: AllowedDurationDays;
}