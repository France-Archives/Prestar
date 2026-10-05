import type { AvailabilityInfo } from "./app";
import type { Book } from "./db";

// MOCK INTEREST PREFERENCES — REPLACE WITH REAL BACKEND LATER
// This table does NOT exist in the current ERD. The backend must add it:
//   user_category_preferences
//     preference_id  PK
//     user_id        FK -> users.user_id
//     category_id    FK -> categories.category_id
//     created_at
//     UNIQUE (user_id, category_id)
// This is the many-to-many link between users and categories.
export interface UserCategoryPreference {
  preference_id: number;
  user_id: number;
  category_id: number;
  created_at: string;
}

export interface Recommendation {
  book: Book;
  category: string;
  availability: AvailabilityInfo;
  reason: string;
}