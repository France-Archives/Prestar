import type { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ToastProvider } from "@/context/ToastContext";

// Order matters: notifications need the signed-in user, so they sit inside AuthProvider.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </AuthProvider>
    </ToastProvider>
  );
}