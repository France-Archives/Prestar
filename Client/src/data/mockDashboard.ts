import type { PopularBook, UUID } from "@/types";
import { dateKey } from "@/utils/formatDate";
import { bookId, bookTitle } from "./mockBooks";
import { at } from "./mockHelpers";
import { STUDENT_ID } from "./mockUsers";

// TEMPORARY MOCK IMPLEMENTATION: fake historical statistics and recommendations.
// Replace with backend statistics/reports (P13, D1 to D4). Counts that CAN be derived from the other mock
// files (active loans, overdue, unpaid balance, copies by status) are computed live by the service instead.
// KPI definitions are not in the source (TC-16).

const popular = (no: number, loanCount: number): PopularBook => ({ bookId: bookId(no), title: bookTitle(bookId(no)), loanCount });

/** Most borrowed titles, highest first. */
export const MOCK_POPULAR_BOOKS: PopularBook[] = [
  popular(1, 42),
  popular(6, 37),
  popular(8, 31),
  popular(3, 24),
  popular(5, 22),
  popular(10, 15),
];

/** Recommendations per student (book ids). A real backend derives these from interests and borrowing history. */
export const MOCK_RECOMMENDATIONS: Record<UUID, UUID[]> = {
  [STUDENT_ID.ana]: [bookId(6), bookId(3), bookId(5), bookId(12)],
  [STUDENT_ID.ben]: [bookId(6), bookId(10), bookId(1), bookId(8)],
  [STUDENT_ID.carla]: [bookId(11), bookId(9), bookId(2), bookId(7)],
  [STUDENT_ID.dan]: [bookId(12), bookId(1), bookId(5), bookId(7)],
  [STUDENT_ID.gina]: [bookId(7), bookId(9), bookId(12), bookId(1)],
};

/** Loans issued / returns for the last 7 days (Manila dates), oldest first. */
const ISSUED = [3, 5, 2, 6, 4, 1, 2];
const RETURNED = [2, 4, 3, 5, 3, 2, 1];
export const MOCK_ACTIVITY_LAST_7_DAYS: { date: string; loansIssued: number; returns: number }[] = ISSUED.map((n, k) => ({
  date: dateKey(at(k - 6)),
  loansIssued: n,
  returns: RETURNED[k],
}));