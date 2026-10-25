import { useContext } from "react";
import { ToastContext, type ToastContextValue } from "@/context/ToastContext";

// Show success / error / info toasts. Must be used inside <ToastProvider>.
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}