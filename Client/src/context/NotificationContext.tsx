import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { NotificationItem } from "@/types";
import * as notificationsService from "@/services/notificationsService";
import { subscribeStore } from "@/services/mockStore";
import { useAuth } from "@/hooks/useAuth";

// Shared state for the notification bell: unread count plus the latest few items.
// The backend creates notifications (only after a transaction commits); the frontend only reads and marks them read.
// TEMPORARY MOCK IMPLEMENTATION: notificationsService reads the in-memory store. Replace with S6 to S8 later.
// The subscribeStore effect refreshes the bell after any mock mutation. Real backend: poll or use a push channel instead.

const RECENT_COUNT = 5;

export interface NotificationContextValue {
  unreadCount: number;
  recent: NotificationItem[];
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++seq.current;
    if (!userId) {
      setUnreadCount(0);
      setRecent([]);
      return;
    }
    try {
      const [page, unread] = await Promise.all([
        notificationsService.listNotifications({ page: 1, pageSize: RECENT_COUNT }),
        notificationsService.getUnreadCount(),
      ]);
      if (id !== seq.current) return;
      setRecent(page.data);
      setUnreadCount(unread);
    } catch {
      /* The bell is non-critical: keep the last known values. */
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(Boolean(userId));
    void refresh();
  }, [userId, refresh]);

  // TEMPORARY MOCK: refresh after any mock mutation.
  useEffect(() => (userId ? subscribeStore(() => void refresh()) : undefined), [userId, refresh]);

  const markRead = useCallback(
    async (id: string) => {
      await notificationsService.markRead(id);
      await refresh();
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    await notificationsService.markAllRead();
    await refresh();
  }, [refresh]);

  const value = useMemo<NotificationContextValue>(
    () => ({ unreadCount, recent, loading, refresh, markRead, markAllRead }),
    [unreadCount, recent, loading, refresh, markRead, markAllRead],
  );
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}