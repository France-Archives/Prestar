import { Link } from "react-router-dom";
import { notificationsPathFor } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";

export default function NotificationBell() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  if (!user) return null;
  return (
    <Link
      to={notificationsPathFor(user)}
      aria-label={`Notifications, ${unreadCount} unread`}
      className="relative grid h-10 w-10 place-items-center rounded-lg text-forest hover:bg-mist"
      style={{ textDecoration: "none" }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unreadCount > 0 && (
        <b className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-amber px-1 text-[10px] font-bold leading-none text-forest-deep">
          {unreadCount > 99 ? "99+" : unreadCount}
        </b>
      )}
    </Link>
  );
}