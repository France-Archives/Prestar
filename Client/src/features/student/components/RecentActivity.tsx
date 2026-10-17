import { Link } from "react-router-dom";
import Card from "@/components/ui/Card";
import { ROUTES } from "@/app/routeConfig";
import type { NotificationItem } from "@/types";
import { formatDate } from "@/utils/formatDate";

export default function RecentActivity({ items }: { items: NotificationItem[] }) {
  return (
    <Card title="Recent notifications" actions={<Link to={ROUTES.student.notifications} className="link-btn">View all</Link>}>
      {items.length === 0 ? (
        <p className="subtle">You're all caught up.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
          {items.map((n) => (
            <li key={n.id}>
              <b style={{ color: "var(--color-forest)" }}>{n.readAt === null ? "● " : ""}{n.title}</b>
              <span className="subtle"> · {formatDate(n.createdAt)}</span>
              <p style={{ fontSize: "0.875rem" }}>{n.message}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}