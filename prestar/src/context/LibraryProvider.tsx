import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import * as api from "../services/api";
import { resetInterests } from "../services/interests";
import type { ApiResult } from "../types";
import { LibraryContext, type LibraryContextValue } from "./LibraryContext";

const SESSION_KEY = "prestar_session_v2";

export function LibraryProvider({ children }: { children: ReactNode }) {
  // MOCK DATA — REPLACE WITH API FETCH LATER (the whole database snapshot comes from the mock service)
  const db = useSyncExternalStore(api.subscribe, api.getDb);

  // MOCK AUTH — REPLACE WITH REAL BACKEND AUTHENTICATION LATER (a real app keeps a cookie session, not a user id)
  const [userId, setUserId] = useState<number | null>(() => Number(localStorage.getItem(SESSION_KEY)) || null);
  const [toast, setToast] = useState<string | null>(null);

  // The role is always read from the users table, never stored on its own.
  const user = useMemo(() => {
    const u = db.users.find((x) => x.user_id === userId);
    return u && u.status === "Active" ? api.publicUser(u) : null;
  }, [db, userId]);

  useEffect(() => {
    if (userId) localStorage.setItem(SESSION_KEY, String(userId));
    else localStorage.removeItem(SESSION_KEY);
  }, [userId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = useCallback((msg: string) => setToast(msg), []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    if (res.ok) setUserId(res.data.user_id);
    return res;
  }, []);
  const logout = useCallback(() => setUserId(null), []);

  const act = useCallback(
    async <T,>(promise: Promise<ApiResult<T>>, okMsg?: string): Promise<ApiResult<T>> => {
      const res = await promise;
      if (!res.ok) notify(res.error);
      else if (okMsg) notify(okMsg);
      return res;
    },
    [notify],
  );

  // Resets BOTH mock stores: the main database and the separately stored student interests.
  const resetDemo = useCallback(() => {
    api.resetMockData();
    resetInterests();
  }, []);

  const value: LibraryContextValue = { db, user, login, logout, toast, notify, act, resetDemo };
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}