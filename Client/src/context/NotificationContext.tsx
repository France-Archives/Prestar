import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { NotificationItem } from "@/types";
import * as notificationsService from "@/services/notificationsService";
import { subscribeStore } from "@/services/mockStore";
import { useAuth } from "@/hooks/useAuth";
import { USE_MOCKS } from "@/utils/constants";

// Shared notification state for the mock bell; live notifications are unavailable from the current Server API.

const RECENT_COUNT = 5;

export interface NotificationContextValue {
  unreadCount: number | null;
  recent: NotificationItem[] | null;
  available: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [unreadCount, setUnreadCount] = useState<number | null>(USE_MOCKS ? 0 : null);
  const [recent, setRecent] = useState<NotificationItem[] | null>(USE_MOCKS ? [] : null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++seq.current;
    if (!userId) {
      setUnreadCount(0);
      setRecent([]);
      return;
    }
    if (!USE_MOCKS) {
      setUnreadCount(null);
      setRecent(null);
      setLoading(false);
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
  useEffect(() => (userId && USE_MOCKS ? subscribeStore(() => void refresh()) : undefined), [userId, refresh]);

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
    () => ({ unreadCount, recent, available: USE_MOCKS, loading, refresh, markRead, markAllRead }),
    [unreadCount, recent, loading, refresh, markRead, markAllRead],
  );
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}