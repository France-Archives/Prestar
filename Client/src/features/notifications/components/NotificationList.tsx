import EmptyState from "@/components/feedback/EmptyState";
import type { NotificationItem as Item, UserRole } from "@/types";
import NotificationItem from "./NotificationItem";

interface NotificationListProps {
  items: Item[];
  role: UserRole;
  onRead: (id: string) => void;
  busyIds?: Set<string>;
}

export default function NotificationList({ items, role, onRead, busyIds = new Set() }: NotificationListProps) {
  if (items.length === 0) return <EmptyState title="You're all caught up" text="New updates about your requests and loans appear here." />;
  return (
    <ul className="stack" style={{ padding: 0, gap: 10 }}>
      {items.map((n) => (
        <NotificationItem key={n.id} item={n} role={role} onRead={onRead} readBusy={busyIds.has(n.id)} />
      ))}
    </ul>
  );
}