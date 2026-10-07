import type { ApiResult, UserCategoryPreference } from "../types";
import { CONFIG } from "../utils/constants";
import { nowIso } from "../utils/dates";
import { getDb } from "./api";

// MOCK INTEREST PREFERENCES — REPLACE WITH REAL BACKEND LATER
// Simulates the missing user_category_preferences table (see types/interest.ts).
// Rows are saved to their own localStorage key so a refresh or a logout/login keeps each
// student's choices. Real version: GET and PUT /api/me/interests (placeholder name, not an existing route).

const KEY = "prestar_mock_interests_v1";

type StoredRow = Partial<UserCategoryPreference> & { user_id: number; category_id: number };

// Rows saved by the previous version have no preference_id yet, so give them one.
function normalize(rows: StoredRow[]): UserCategoryPreference[] {
  let maxId = rows.reduce((m, r) => Math.max(m, r.preference_id ?? 0), 0);
  return rows.map((r) => ({
    preference_id: r.preference_id ?? ++maxId,
    user_id: r.user_id,
    category_id: r.category_id,
    created_at: r.created_at ?? nowIso(),
  }));
}

function load(): UserCategoryPreference[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const rows = (parsed as Partial<UserCategoryPreference>[]).filter(
          (r): r is StoredRow => typeof r.user_id === "number" && typeof r.category_id === "number",
        );
        return normalize(rows);
      }
    }
  } catch {
    /* start empty */
  }
  return [];
}

let preferences: UserCategoryPreference[] = load();
const listeners = new Set<() => void>();

export const subscribeInterests = (f: () => void): (() => void) => {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
};
// A new array after every save, so useSyncExternalStore sees the change.
export const getInterestPreferences = (): UserCategoryPreference[] => preferences;

export const getInterestIds = (userId: number): number[] =>
  preferences.filter((p) => p.user_id === userId).map((p) => p.category_id);

// Clears every student's interests. Called together with the main "reset demo data", because the
// interests live under their own localStorage key and would otherwise be inherited by new users
// that reuse the same low user ids after a reset.
export function resetInterests() {
  preferences = [];
  localStorage.removeItem(KEY);
  listeners.forEach((f) => f());
}

// Replaces the student's selection: removed categories are deleted, new ones inserted,
// kept ones keep their preference_id. UNIQUE(user_id, category_id) holds because ids are de-duplicated.
export async function saveInterests(userId: number, categoryIds: number[]): Promise<ApiResult<number[]>> {
  await new Promise<void>((resolve) => setTimeout(resolve, 300));
  const db = getDb();
  const user = db.users.find((u) => u.user_id === userId);
  if (!user || user.status !== "Active" || user.role !== "Student") {
    return { ok: false, error: "Only active students can save book interests." };
  }
  const ids = [...new Set(categoryIds)];
  const min = CONFIG.MIN_INTERESTS;
  if (ids.length < min) return { ok: false, error: `Choose at least ${min} categor${min === 1 ? "y" : "ies"}.` };
  if (ids.some((id) => !db.categories.some((c) => c.category_id === id))) {
    return { ok: false, error: "One of the selected categories no longer exists. Please reload and try again." };
  }

  const previous = preferences;
  const others = preferences.filter((p) => p.user_id !== userId);
  const mine = preferences.filter((p) => p.user_id === userId && ids.includes(p.category_id));
  let nextId = preferences.reduce((m, p) => Math.max(m, p.preference_id), 0);
  const created_at = nowIso();
  const added = ids
    .filter((id) => !mine.some((p) => p.category_id === id))
    .map((category_id): UserCategoryPreference => ({ preference_id: ++nextId, user_id: userId, category_id, created_at }));

  preferences = [...others, ...mine, ...added];
  try {
    localStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {
    preferences = previous; // roll back, like a failed transaction
    return { ok: false, error: "Could not save your interests. Please try again." };
  }
  listeners.forEach((f) => f());
  return { ok: true, data: ids };
}