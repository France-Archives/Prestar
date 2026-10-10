import { Link } from "react-router-dom";

interface StatCardProps {
  label: string;
  value: string | number;
  to?: string;
  alert?: boolean;
  hint?: string;
}

export default function StatCard({ label, value, to, alert = false, hint }: StatCardProps) {
  const body = (
    <>
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