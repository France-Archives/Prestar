import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "@/context/AuthContext";

// Access the current user and session actions. Must be used inside <AuthProvider>.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}