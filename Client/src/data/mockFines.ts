import type { FinePayment, StaffFine, UUID } from "@/types";
import { loanId } from "./mockBorrowings";
import { bookId, bookTitle } from "./mockBooks";
import { NS, at, uid } from "./mockHelpers";
import { STUDENT_ID, USER_ID } from "./mockUsers";

// TEMPORARY MOCK IMPLEMENTATION: fake fines, penalties and payment records.
// Replace with real fines/payment records (F1 to F3, P10, P11).
// Amounts are fixed by type: ₱100 minor, ₱200 major, ₱500 lost. There is NO daily overdue fine and NO student "My Fines" page.
// paidAmount, balance and the student/title joins are COMPUTED by the service from these raw rows.

export type MockFine = Omit<StaffFine, "student" | "paidAmount" | "balance"> & { studentId: UUID };
export type MockPayment = FinePayment; // the service adds student, fine type and recorder name

export const fineId = (n: number): UUID => uid(NS.fine, n);

export const MOCK_FINES: MockFine[] = [
  {
    id: fineId(1),
    studentId: STUDENT_ID.carla,
    loanId: loanId(5),
    bookTitle: bookTitle(bookId(10)),
    fineType: "DAMAGE_MINOR",
    amount: 100,
    status: "UNPAID",
    recordedAt: at(-42),
    notes: "Torn pages found on return.",
  },
  {
    id: fineId(2),
    studentId: STUDENT_ID.felix,
    loanId: loanId(6),
    bookTitle: bookTitle(bookId(9)),
    fineType: "LOST_BOOK",
    amount: 500,
    status: "PARTIALLY_PAID",
    recordedAt: at(-30),
    notes: "Marked lost after confirming with the student.",
  },
  {
    id: fineId(3),
    studentId: STUDENT_ID.ben,
    loanId: loanId(3),
    bookTitle: bookTitle(bookId(8)),
    fineType: "DAMAGE_MINOR",
    amount: 100,
    status: "PAID",
    recordedAt: at(-47),
    notes: "Water stain on the back cover.",
  },
  {
    id: fineId(4),
    studentId: STUDENT_ID.ana,
    loanId: loanId(4),
    bookTitle: bookTitle(bookId(5)),
    fineType: "DAMAGE_MINOR",
    amount: 100,
    status: "WAIVED",
    recordedAt: at(-34),
    notes: "Waived by Admin: the damage was already present.",
  },
];

export const MOCK_PAYMENTS: MockPayment[] = [
  { id: uid(NS.payment, 1), fineId: fineId(2), amount: 300, paymentMethod: "CASH", referenceNumber: null, paidAt: at(-20), recordedByUserId: USER_ID.leo },
  { id: uid(NS.payment, 2), fineId: fineId(3), amount: 100, paymentMethod: "CASH", referenceNumber: null, paidAt: at(-45), recordedByUserId: USER_ID.leo },
];