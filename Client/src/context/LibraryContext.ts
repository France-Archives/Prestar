import { createContext, useContext } from "react";
import type { ApiResult, Database, PublicUser } from "../types";

export interface LibraryContextValue {
  db: Database;
  user: PublicUser | null;
  login: (email: string, password: string) => Promise<ApiResult<PublicUser>>;
  logout: () => void;
  toast: string | null;
  notify: (msg: string) => void;
  // Await an api call, toast the error (or the success message), and hand the result back.
  act: <T>(promise: Promise<ApiResult<T>>, okMsg?: string) => Promise<ApiResult<T>>;
  resetDemo: () => void;
}

export type AuthedLibraryValue = Omit<LibraryContextValue, "user"> & { user: PublicUser };

export const LibraryContext = createContext<LibraryContextValue | null>(null);

// For login, signup and route guards, where `user` may be null.
export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used inside <LibraryProvider>");
  return ctx;
}

// For pages behind <RequireRole>, where a user always exists.
export function useAuthedLibrary(): AuthedLibraryValue {
  const { user, ...rest } = useLibrary();
  if (!user) throw new Error("useAuthedLibrary was used while logged out");
  return { user, ...rest };
}