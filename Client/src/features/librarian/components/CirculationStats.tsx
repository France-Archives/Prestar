import { CalendarClock, Clock, FileCheck, PackageCheck, ShieldAlert } from "lucide-react";
import StatCard from "@/components/data-display/StatCard";
import { ROUTES } from "@/app/routeConfig";
import type { StaffDashboardData } from "@/types";

export default function CirculationStats({ data }: { data: StaffDashboardData }) {
  const T = ROUTES.staff;
  return (
    <div className="stat-grid">
      <StatCard icon={PackageCheck} label="Awaiting release" value={data.awaitingRelease} to={T.booksToRelease} />
      <StatCard icon={ShieldAlert} label="On hold" value={data.onHold} to={T.booksToRelease} alert={data.onHold > 0} />
      <StatCard icon={Clock} label="Overdue loans" value={data.overdueLoans.length} to={T.returns} alert={data.overdueLoans.length > 0} />
      <StatCard icon={CalendarClock} label="Offers outstanding" value={data.offeredReservations.length} to={T.reservations} />
      {data.pendingCorReviews !== null && <StatCard icon={FileCheck} label="Pending COR reviews" value={data.pendingCorReviews} to={T.corReview} />}
    </div>
  );
}