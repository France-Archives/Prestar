import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LoginRequest, SessionUser } from "@/types";
import * as authService from "@/services/authService";
import { UNAUTHENTICATED_EVENT } from "@/services/apiClient";
import { subscribeStore } from "@/services/mockStore";

// Holds the signed-in user for the UI. This is a UX convenience only: the backend decides what a user may do.
// TEMPORARY MOCK IMPLEMENTATION: authService.getCurrentUser/login/logout run on the in-memory mock.
// Replace those service bodies with A8 / A2 / A3 when the backend exists; this file does not change.
// subscribeStore re-reads the session after every mock mutation so profile or status changes show up.
// Delete that one effect when the mocks are removed.

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  user: SessionUser | null;
  status: AuthStatus;
  login: (req: LoginRequest) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  // Newest request wins, so a slow refresh can never overwrite a newer login or logout.
  const seq = useRef(0);

  const apply = useCallback((next: SessionUser | null) => {
    // Keep the same object when nothing changed, so consumers do not re-render on every mock commit.
    setUser((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    setStatus(next ? "authenticated" : "unauthenticated");
  }, []);

  const refresh = useCallback(async () => {
    const id = ++seq.current;
    try {
      const current = await authService.getCurrentUser();
      if (id === seq.current) apply(current);
    } catch {
      if (id === seq.current) apply(null);
    }
  }, [apply]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // TEMPORARY MOCK: re-read the session after any mock mutation.
  useEffect(() => subscribeStore(() => void refresh()), [refresh]);

  // The API client raises this on a 401 UNAUTHENTICATED response (real backend).
  useEffect(() => {
    const onUnauthenticated = () => {
      seq.current++;
      apply(null);
    };
    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
  }, [apply]);

  const login = useCallback(
    async (req: LoginRequest) => {
      const signedIn = await authService.login(req);
      seq.current++;
      apply(signedIn);
      return signedIn;
    },
    [apply],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      seq.current++;
      apply(null);
    }
  }, [apply]);

  const value = useMemo<AuthContextValue>(() => ({ user, status, login, logout, refresh }), [user, status, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}