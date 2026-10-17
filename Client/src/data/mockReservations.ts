import type { Reservation, UUID } from "@/types";
import { bookId, bookTitle, copyId } from "./mockBooks";
import { NS, at, uid } from "./mockHelpers";
import { STUDENT_ID } from "./mockUsers";

// TEMPORARY MOCK IMPLEMENTATION: fake reservation queue and statuses.
// Replace with real reservation data (B4, B5, P5, P7). queuePosition is COMPUTED by the service (FIFO by reservedAt, then id).
// Reservations exist only when no copy is available. OFFERED = a copy is held for that student for 3 days.

export type MockReservation = Reservation & { studentId: UUID };

export const reservationId = (n: number): UUID => uid(NS.reservation, n);

const make = (
  n: number,
  student: UUID,
  book: number,
  status: Reservation["status"],
  reservedDays: number,
  pickupDeadlineDays: number | null,
  offeredCopy: [number, number] | null,
): MockReservation => ({
  id: reservationId(n),
  studentId: student,
  bookId: bookId(book),
  bookTitle: bookTitle(bookId(book)),
  status,
  reservedAt: at(reservedDays),
  pickupDeadline: pickupDeadlineDays === null ? null : at(pickupDeadlineDays),
  offeredCopyId: offeredCopy ? copyId(offeredCopy[0], offeredCopy[1]) : null,
});

export const MOCK_RESERVATIONS: MockReservation[] = [
  // Queue for "The Design of Everyday Things" (its only copy is on loan). Felix is first but suspended, so he is skipped.
  make(1, STUDENT_ID.felix, 4, "WAITING", -3, null, null),
  make(2, STUDENT_ID.ben, 4, "WAITING", -2, null, null),
  // A copy of "Thinking, Fast and Slow" is held for Ana
  make(3, STUDENT_ID.ana, 7, "OFFERED", -6, 2, [7, 1]),
  // History
  make(4, STUDENT_ID.ana, 6, "EXPIRED", -34, -27, null),
  make(5, STUDENT_ID.ben, 3, "CANCELLED", -20, null, null),
];