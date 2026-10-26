import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Interest, LoginRequest, SessionUser, UpdateInterestsRequest } from "@/types";
import * as authService from "@/services/authService";
import { UNAUTHENTICATED_EVENT } from "@/services/apiClient";
import { subscribeStore } from "@/services/mockStore";
import { normalizeUserRole } from "@/utils/permissions";
import { describeError } from "@/utils/errors";

// Holds the signed-in user for the UI. This is a UX convenience only: the backend decides what a user may do.
// authService selects mock or live authentication based on VITE_USE_MOCKS.
// subscribeStore re-reads the session after mock mutations so profile or status changes show up.

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";
export type InterestsStatus = "not-required" | "loading" | "loaded" | "error";

export interface AuthContextValue {
  user: SessionUser | null;
  status: AuthStatus;
  sessionError: string | null;
  interests: Interest[] | null;
  interestsStatus: InterestsStatus;
  interestsError: string | null;
  login: (req: LoginRequest) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshInterests: () => Promise<void>;
  updateInterests: (request: UpdateInterestsRequest) => Promise<Interest[]>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [interests, setInterests] = useState<Interest[] | null>(null);
  const [interestsStatus, setInterestsStatus] = useState<InterestsStatus>("not-required");
  const [interestsError, setInterestsError] = useState<string | null>(null);
  // Newest request wins, so a slow refresh can never overwrite a newer login or logout.
  const seq = useRef(0);
  const interestsSeq = useRef(0);

  const apply = useCallback((next: SessionUser | null) => {
    const normalized = next && normalizeUserRole(next.role) ? { ...next, role: normalizeUserRole(next.role)! } : null;
    // Keep the same object when nothing changed, so consumers do not re-render on every mock commit.
    setUser((prev) => (JSON.stringify(prev) === JSON.stringify(normalized) ? prev : normalized));
    setStatus(normalized ? "authenticated" : "unauthenticated");
    setSessionError(null);
  }, []);

  const refresh = useCallback(async () => {
    const id = ++seq.current;
    setSessionError(null);
    try {
      const current = await authService.getCurrentUser();
      if (id === seq.current) apply(current);
    } catch (error) {
      if (id === seq.current) {
        setSessionError(describeError(error));
        setStatus((current) => current === "loading" ? "error" : current);
      }
    }
  }, [apply]);

  const refreshInterests = useCallback(async () => {
    const id = ++interestsSeq.current;
    if (user?.role !== "STUDENT") {
      setInterests(null);
      setInterestsError(null);
      setInterestsStatus("not-required");
      return;
    }
    setInterestsError(null);
    setInterestsStatus("loading");
    try {
      const current = await authService.getMyInterests();
      if (id === interestsSeq.current) {
        setInterests(current);
        setInterestsStatus("loaded");
      }
    } catch (error) {
      if (id === interestsSeq.current) {
        setInterestsError(describeError(error));
        setInterestsStatus("error");
      }
    }
  }, [user?.id, user?.role]);

  const updateInterests = useCallback(async (request: UpdateInterestsRequest) => {
    const updated = await authService.updateMyInterests(request);
    interestsSeq.current++;
    setInterests(updated);
    setInterestsError(null);
    setInterestsStatus("loaded");
    return updated;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (user?.role === "STUDENT") {
      void refreshInterests();
      return;
    }
    interestsSeq.current++;
    setInterests(null);
    setInterestsError(null);
    setInterestsStatus("not-required");
  }, [user?.id, user?.role, refreshInterests]);

  // Re-read the session after mock mutations.
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

  const value = useMemo<AuthContextValue>(() => ({
    user,
    status,
    sessionError,
    interests,
    interestsStatus,
    interestsError,
    login,
    logout,
    refresh,
    refreshInterests,
    updateInterests,
  }), [user, status, sessionError, interests, interestsStatus, interestsError, login, logout, refresh, refreshInterests, updateInterests]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}