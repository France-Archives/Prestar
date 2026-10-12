import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  to?: string;
  alert?: boolean;
  hint?: string;
  icon?: LucideIcon;
}

export default function StatCard({ label, value, to, alert = false, hint, icon: Icon }: StatCardProps) {
  const body = (
    <>
      {Icon && (
        <span className="stat__icon" aria-hidden="true">
          <Icon size={18} strokeWidth={1.9} />
        </span>
      )}
      <b>{value}</b>
      <span>{label}</span>
      {hint && <small className="subtle">{hint}</small>}
    </>
  );
  const cls = `card stat ${alert ? "alert" : ""}`;
  if (to) {
    return (
      <Link to={to} className={cls} style={{ textDecoration: "none" }}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}