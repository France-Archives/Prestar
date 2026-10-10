import type { RenewalView, UUID } from "@/types";
import { bookId, bookTitle } from "./mockBooks";
import { loanId } from "./mockBorrowings";
import { NS, at, uid } from "./mockHelpers";
import { STUDENT_ID } from "./mockUsers";

// TEMPORARY MOCK IMPLEMENTATION: fake renewal requests and results. Replace with real renewal responses (B6, P14).
// Renewals are decided automatically. New due date = approval date + duration; old and new dates are both kept.

export type MockRenewal = RenewalView & { studentId: UUID };

export const MOCK_RENEWALS: MockRenewal[] = [
  {
    // Matches loan 7: due in 4 days, renewed yesterday for 14 days -> new due in 13 days
    id: uid(NS.renewal, 1),
    studentId: STUDENT_ID.ana,
    loanId: loanId(7),
    bookTitle: bookTitle(bookId(8)),
    requestedDurationDays: 14,
    status: "APPROVED",
    requestedAt: at(-1),
    approvedAt: at(-1),
    oldDueAt: at(4),
    newDueAt: at(13),
    decisionReason: null,
  },
  {
    id: uid(NS.renewal, 2),
    studentId: STUDENT_ID.ana,
    loanId: loanId(4),
    bookTitle: bookTitle(bookId(5)),
    requestedDurationDays: 7,
    status: "REJECTED",
    requestedAt: at(-35),
    approvedAt: null,
    oldDueAt: null,
    newDueAt: null,
    decisionReason: "Another student is waiting for this title.",
  },
];