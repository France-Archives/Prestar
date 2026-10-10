import { useContext } from "react";
import { NotificationContext, type NotificationContextValue } from "@/context/NotificationContext";

// Read bell state (unread count, latest items) and actions. Must be used inside <NotificationProvider>.
export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationProvider>");
  return ctx;
}