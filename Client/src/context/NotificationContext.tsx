import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { NotificationItem } from "@/types";
import * as notificationsService from "@/services/notificationsService";
import { subscribeStore } from "@/services/mockStore";
import { useAuth } from "@/hooks/useAuth";
import { USE_MOCKS } from "@/utils/constants";
import { describeError } from "@/utils/errors";

const RECENT_COUNT = 5;

export interface NotificationContextValue {
  unreadCount: number | null;
  recent: NotificationItem[] | null;
  available: boolean;
  loading: boolean;
  error: string | null;
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
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++seq.current;
    if (!userId) {
      setUnreadCount(0);
      setRecent([]);
      setError(null);
      return;
    }
    const [pageResult, countResult] = await Promise.all([
      notificationsService.listNotifications({ page: 1, pageSize: RECENT_COUNT })
        .then((value) => ({ value }), (reason: unknown) => ({ error: reason })),
      notificationsService.getUnreadCount()
        .then((value) => ({ value }), (reason: unknown) => ({ error: reason })),
    ]);
    if (id !== seq.current) return;
    const failures: string[] = [];
    if ("value" in pageResult) setRecent(pageResult.value.data);
    else failures.push(describeError(pageResult.error));
    if ("value" in countResult) setUnreadCount(countResult.value);
    else failures.push(describeError(countResult.error));
    setError(failures.length ? failures.join(" ") : null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(Boolean(userId));
    void refresh();
  }, [userId, refresh]);

  // TEMPORARY MOCK: refresh after any mock mutation.
  useEffect(() => (userId && USE_MOCKS ? subscribeStore(() => void refresh()) : undefined), [userId, refresh]);

  useEffect(() => {
    if (!userId) return;
    const poll = () => {
      if (!document.hidden) void refresh();
    };
    const interval = window.setInterval(poll, 45_000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [userId, refresh]);

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
    () => ({ unreadCount, recent, available: true, loading, error, refresh, markRead, markAllRead }),
    [unreadCount, recent, loading, error, refresh, markRead, markAllRead],
  );
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}