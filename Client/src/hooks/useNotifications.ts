import { useMemo, useSyncExternalStore } from "react";
import { useLive } from "./useLive";
import { useAuthedLibrary } from "../context/LibraryContext";
import * as api from "../services/api";

// Notifications are DERIVED from existing rows (Decision C), so there is no table.
// Read/unread is browser-only (per device), kept in localStorage.
const key = (uid: number) => `prestar_read_${uid}`;
const listeners = new Set<() => void>();
const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
};

export function useNotifications() {
  const { user } = useAuthedLibrary();
  const uid = user.user_id;
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(key(uid)) ?? "[]");
  const items = useLive(() => api.getNotifications(uid));
  const readIds = useMemo(() => new Set<string>(JSON.parse(raw) as string[]), [raw]);

  const save = (ids: Set<string>) => {
    localStorage.setItem(key(uid), JSON.stringify([...ids]));
    listeners.forEach((f) => f());
  };
  return {
    items,
    unread: items.filter((i) => !readIds.has(i.id)).length,
    isRead: (id: string) => readIds.has(id),
    markRead: (id: string) => save(new Set([...readIds, id])),
    markAllRead: () => save(new Set([...readIds, ...items.map((i) => i.id)])),
  };
}