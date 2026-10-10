import type { ISODateTime, UUID } from "./api";
import type { ReservationStatus } from "./enums";
import type { CopyRef } from "./book";
import type { StudentRef } from "./user";

// reservations -> Reservation
export interface Reservation {
  id: UUID;
  bookId: UUID;
  bookTitle: string;
  status: ReservationStatus;
  reservedAt: ISODateTime;
  pickupDeadline: ISODateTime | null; // set when OFFERED
  queuePosition?: number; // computed, FIFO by reservedAt then id
  offeredCopyId?: UUID | null;
}

/** P5 GET /staff/reservations (proposed). */
export interface StaffReservation extends Reservation {
  student: StudentRef;
  queuePosition: number;
  offeredCopy: CopyRef | null;
}

/** B4 POST /reservations. Allowed only when no copy is available (else 409 COPY_AVAILABLE). */
export interface CreateReservationRequest {
  bookId: UUID;
}