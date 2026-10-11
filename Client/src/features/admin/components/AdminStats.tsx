import StatCard from "@/components/data-display/StatCard";
import { ROUTES } from "@/app/routeConfig";
import type { AdminDashboardData } from "@/types";
import { formatPeso } from "@/utils/formatCurrency";

export default function AdminStats({ data }: { data: AdminDashboardData }) {
  const A = ROUTES.admin;
  const T = ROUTES.staff;
  return (
    <div className="grid-auto" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
      <StatCard label="Students" value={data.totalStudents} to={A.users} />
      <StatCard label="Librarians" value={data.totalLibrarians} to={A.librarians} />
      <StatCard label="Active loans" value={data.activeLoans} to={T.returns} />
      <StatCard label="Overdue loans" value={data.overdueLoans} to={T.returns} alert={data.overdueLoans > 0} />
      <StatCard label="Pending COR reviews" value={data.pendingCorReviews} to={A.cor} alert={data.pendingCorReviews > 0} />
      <StatCard label="Unpaid fine balance" value={formatPeso(data.unpaidFineBalance)} to={A.finesAndPayments} />
    </div>
  );
}