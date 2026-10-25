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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const created = new Date(item.createdAt);
    const day = new Date(created);
    day.setHours(0, 0, 0, 0);
    const key = Number.isNaN(created.getTime()) || day < yesterday ? "Earlier" : day < today ? "Yesterday" : "Today";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const order = ["Today", "Yesterday", "Earlier"];

  return (
    <div className="notification-list">
      {order.map((group) => {
        const groupedItems = groups.get(group);
        if (!groupedItems?.length) return null;
        return (
          <section className="notification-group" key={group} aria-label={group}>
            <h2 className="notification-group__title">{group}</h2>
            <ul className="notification-items">
              {groupedItems.map((item) => (
                <NotificationItem key={item.id} item={item} role={role} onRead={onRead} readBusy={busyIds.has(item.id)} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}