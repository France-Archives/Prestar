import { useMemo, useSyncExternalStore } from "react";
import { getInterestPreferences, subscribeInterests } from "../services/interests";

// Selected category IDs for one student. Pass null when nobody (or a non-student) is logged in.
export function useInterests(userId: number | null): number[] {
  const rows = useSyncExternalStore(subscribeInterests, getInterestPreferences);
  return useMemo(
    () => (userId === null ? [] : rows.filter((p) => p.user_id === userId).map((p) => p.category_id)),
    [rows, userId],
  );
}