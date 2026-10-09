import type { Recommendation } from "../types";
import { bookAvailability, getDb } from "./api";

// MOCK API — REPLACE WITH REAL API CALL LATER (a backend endpoint like GET /api/me/recommendations)
// Nothing is hardcoded: every result is derived from the books, categories, loans and the
// student's selected interests.

const INTEREST_WEIGHT = 3; // title is in a category the student selected
const HISTORY_WEIGHT = 1; // per previous loan in the same category...
const HISTORY_CAP = 3; // ...up to this many loans
const AVAILABLE_BONUS = 1; // a copy is free to request right now

export function getRecommendations(userId: number, interestIds: number[], limit = 4): Recommendation[] {
  const db = getDb();
  const categoryName = new Map(db.categories.map((c) => [c.category_id, c.category_name]));
  const bookById = new Map(db.books.map((b) => [b.book_id, b]));
  const interests = new Set(interestIds);

  // Borrowing history: loans per category. Titles already used or in progress are never recommended.
  const skip = new Set<number>();
  const historyByCategory = new Map<number, number>();
  db.borrowed_books
    .filter((l) => l.user_id === userId)
    .forEach((l) => {
      skip.add(l.book_id);
      const b = bookById.get(l.book_id);
      if (b) historyByCategory.set(b.category_id, (historyByCategory.get(b.category_id) ?? 0) + 1);
    });
  db.borrow_requests.filter((r) => r.user_id === userId && (r.status === "Pending" || r.status === "Approved")).forEach((r) => skip.add(r.book_id));
  db.reservations.filter((r) => r.user_id === userId && (r.status === "Waiting" || r.status === "Ready")).forEach((r) => skip.add(r.book_id));

  return db.books
    .filter((b) => b.status === "Active" && !skip.has(b.book_id))
    .map((book) => {
      const interested = interests.has(book.category_id);
      const history = historyByCategory.get(book.category_id) ?? 0;
      const availability = bookAvailability(book.book_id);
      const base = (interested ? INTEREST_WEIGHT : 0) + Math.min(history, HISTORY_CAP) * HISTORY_WEIGHT;
      const score = base > 0 && availability.circulating > 0 ? base + (availability.free > 0 ? AVAILABLE_BONUS : 0) : 0;
      return { book, interested, history, availability, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title))
    .slice(0, limit)
    .map(({ book, interested, history, availability }): Recommendation => {
      const category = categoryName.get(book.category_id) ?? "this category";
      const reason =
        interested && history > 0
          ? `Matches your interest in ${category} and your borrowing history`
          : interested
            ? `Matches your interest in ${category}`
            : `Because you borrowed ${category} books before`;
      return { book, category, availability, reason };
    });
}