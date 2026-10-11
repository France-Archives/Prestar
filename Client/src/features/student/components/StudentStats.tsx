import StatCard from "@/components/data-display/StatCard";
import { ROUTES } from "@/app/routeConfig";
import type { StudentDashboardData } from "@/types";
import { daysUntil } from "@/utils/formatDate";

export default function StudentStats({ data }: { data: StudentDashboardData }) {
  const S = ROUTES.student;
  const overdue = data.activeLoans.filter((l) => daysUntil(l.dueAt) < 0).length;
  return (
    <div className="grid-auto" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
      <StatCard label="Active commitments" value={`${data.commitments.active} / ${data.commitments.max}`} to={S.borrowings} />
      <StatCard label="Active loans" value={data.activeLoans.length} to={S.borrowings} />
      <StatCard label="Waiting for pickup" value={data.pickupWaiting.length} to={S.requests} />
      <StatCard label="Reservations" value={data.reservations.length} to={S.reservations} />
      <StatCard label="Overdue loans" value={overdue} to={S.borrowings} alert={overdue > 0} />
      <StatCard label="Unread notices" value={data.unreadCount} to={S.notifications} />
    </div>
  );
}