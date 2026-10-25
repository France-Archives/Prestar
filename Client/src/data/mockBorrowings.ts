import type { AllowedDurationDays, BorrowingRequest, BorrowingRequestStatus, HandoverAttempt, Loan, UUID } from "@/types";
import { barcode, bookId, bookTitle, copyId } from "./mockBooks";
import { NS, at, uid } from "./mockHelpers";
import { STUDENT_ID } from "./mockUsers";

// TEMPORARY MOCK IMPLEMENTATION: fake borrowing requests, loans and handover attempts.
// Replace with the real borrowing/loan API responses (B1 to B3, B7, B8, H1 to H7, P4, P8).
// A borrowing request is NOT a loan: a loan exists only after staff confirms the physical handover (CLAIMED).
// studentId = students.id. The service joins the student and copy for staff views.

export type MockBorrowingRequest = BorrowingRequest & { studentId: UUID };
export type MockLoan = Loan & { studentId: UUID };

export const loanId = (n: number): UUID => uid(NS.loan, n);
export const borrowingRequestId = (n: number): UUID => uid(NS.request, n);

interface LoanSeed {
  n: number;
  student: UUID;
  book: number;
  copy: number;
  duration: AllowedDurationDays;
  borrowed: number; // days relative to now
  due: number;
  returned: number | null;
  status: Loan["status"];
  renewed: number;
}

const LOAN_SEEDS: LoanSeed[] = [
  { n: 1, student: STUDENT_ID.ana, book: 1, copy: 1, duration: 7, borrowed: -5, due: 2, returned: null, status: "ACTIVE", renewed: 0 }, // due soon
  { n: 2, student: STUDENT_ID.carla, book: 4, copy: 1, duration: 14, borrowed: -19, due: -5, returned: null, status: "ACTIVE", renewed: 0 }, // 5 days overdue: restricted
  { n: 3, student: STUDENT_ID.ben, book: 8, copy: 1, duration: 14, borrowed: -60, due: -46, returned: -47, status: "RETURNED", renewed: 0 },
  { n: 4, student: STUDENT_ID.ana, book: 5, copy: 1, duration: 7, borrowed: -40, due: -33, returned: -34, status: "RETURNED", renewed: 0 },
  { n: 5, student: STUDENT_ID.carla, book: 10, copy: 1, duration: 7, borrowed: -50, due: -43, returned: -42, status: "RETURNED", renewed: 0 }, // returned 1 day late: inside the grace period
  { n: 6, student: STUDENT_ID.felix, book: 9, copy: 1, duration: 14, borrowed: -45, due: -31, returned: null, status: "LOST", renewed: 0 },
  { n: 7, student: STUDENT_ID.ana, book: 8, copy: 1, duration: 14, borrowed: -10, due: 13, returned: null, status: "ACTIVE", renewed: 1 }, // renewed yesterday for 14 days
];

export const MOCK_LOANS: MockLoan[] = LOAN_SEEDS.map(
  (s): MockLoan => ({
    id: loanId(s.n),
    studentId: s.student,
    bookId: bookId(s.book),
    bookTitle: bookTitle(bookId(s.book)),
    copyId: copyId(s.book, s.copy),
    copyBarcode: barcode(s.book, s.copy),
    status: s.status,
    borrowedAt: at(s.borrowed),
    dueAt: at(s.due),
    returnedAt: s.returned === null ? null : at(s.returned),
    renewedCount: s.renewed,
  }),
);

// Every loan came from a CLAIMED request (request number = loan number).
const claimedRequests: MockBorrowingRequest[] = LOAN_SEEDS.map(
  (s): MockBorrowingRequest => ({
    id: borrowingRequestId(s.n),
    studentId: s.student,
    bookId: bookId(s.book),
    bookTitle: bookTitle(bookId(s.book)),
    assignedCopyId: copyId(s.book, s.copy),
    requestedDurationDays: s.duration,
    status: "CLAIMED",
    requestedAt: at(s.borrowed - 1),
    approvedAt: at(s.borrowed - 1),
    pickupDeadline: at(s.borrowed + 2), // approval + 3 days
    claimedAt: at(s.borrowed),
    decisionReason: null,
  }),
);

function openRequest(
  n: number,
  student: UUID,
  book: number,
  copy: number | null,
  status: BorrowingRequestStatus,
  duration: AllowedDurationDays,
  requestedDays: number,
  extra: Partial<MockBorrowingRequest> = {},
): MockBorrowingRequest {
  return {
    id: borrowingRequestId(n),
    studentId: student,
    bookId: bookId(book),
    bookTitle: bookTitle(bookId(book)),
    assignedCopyId: copy === null ? null : copyId(book, copy),
    requestedDurationDays: duration,
    status,
    requestedAt: at(requestedDays),
    approvedAt: at(requestedDays),
    pickupDeadline: null,
    claimedAt: null,
    decisionReason: null,
    ...extra,
  };
}

export const MOCK_BORROWING_REQUESTS: MockBorrowingRequest[] = [
  ...claimedRequests,
  // Approved, awaiting pickup (appears in Books to Release)
  openRequest(8, STUDENT_ID.ben, 2, 1, "APPROVED", 7, -1, { pickupDeadline: at(2) }),
  // On hold: approved before the loan became more than 3 days overdue
  openRequest(9, STUDENT_ID.carla, 11, 1, "ON_HOLD", 7, -3, {
    pickupDeadline: at(1),
    decisionReason: "Overdue loan to resolve",
  }),
  // Cancelled by the student (copy released)
  openRequest(10, STUDENT_ID.ana, 12, null, "CANCELLED", 7, -20, { approvedAt: at(-20), decisionReason: "Cancelled by the student" }),
  // Expired: pickup deadline passed unclaimed (copy released)
  openRequest(11, STUDENT_ID.ben, 6, null, "EXPIRED", 14, -15, { pickupDeadline: at(-12), decisionReason: "Pickup deadline passed" }),
  // Handover rejected by staff (next step is TO CONFIRM, TC-10; the copy is shown as released)
  openRequest(12, STUDENT_ID.ben, 5, null, "RELEASE_REJECTED", 7, -9, {
    pickupDeadline: at(-6),
    decisionReason: "Copy barcode does not match",
  }),
];

const STAFF = "Leo Cruz";
const attempt = (n: number, request: number, action: HandoverAttempt["action"], days: number, hours: number, reasonCode: string | null, notes: string | null): HandoverAttempt => ({
  id: uid(NS.attempt, n),
  requestId: borrowingRequestId(request),
  action,
  reasonCode,
  notes,
  staffName: STAFF,
  createdAt: at(days, hours),
});

export const MOCK_HANDOVER_ATTEMPTS: HandoverAttempt[] = [
  attempt(1, 1, "CHECKED", -5, -2, null, null),
  attempt(2, 1, "CLAIMED", -5, -1, null, null),
  attempt(3, 9, "CHECKED", -1, -3, null, null),
  attempt(4, 9, "PLACED_ON_HOLD", -1, -3, "OVERDUE_LOAN", "Return the overdue loan 'The Design of Everyday Things' first."),
  attempt(5, 12, "CHECKED", -6, -4, null, null),
  attempt(6, 12, "REJECTED", -6, -4, "COPY_MISMATCH", "Barcode on the shelf copy did not match the assigned copy."),
];