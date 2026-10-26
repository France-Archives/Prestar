import { CalendarClock, Clock, FileCheck, PackageCheck, ShieldAlert } from "lucide-react";
import { ROUTES } from "@/app/routeConfig";
import type { StaffDashboardData } from "@/types";
import { AttentionList, ChartPanel, KpiCard } from "@/features/dashboard/DashboardVisuals";

export default function CirculationStats({ data }: { data: StaffDashboardData }) {
  const T = ROUTES.staff;
  const kpis = [
    { label: "Awaiting release", value: data.awaitingRelease, to: T.booksToRelease, icon: PackageCheck, tone: "forest" as const },
    { label: "On hold", value: data.onHold, to: T.booksToRelease, icon: ShieldAlert, tone: "amber" as const, alert: data.onHold > 0 },
    { label: "Overdue loans", value: data.overdueLoans.length, to: T.returns, icon: Clock, tone: "brick" as const, alert: data.overdueLoans.length > 0 },
    { label: "Offers outstanding", value: data.offeredReservations.length, to: T.reservations, icon: CalendarClock, tone: "teal" as const },
    { label: "Pending COR reviews", value: data.pendingCorReviews ?? "Not available yet", to: T.corReview, icon: FileCheck, tone: "amber" as const, alert: data.pendingCorReviews !== null && data.pendingCorReviews > 0 },
  ];
  const attention = [
    { label: "Books to release", count: data.awaitingRelease, to: T.booksToRelease },
    { label: "Requests on hold", count: data.onHold, to: T.booksToRelease },
    { label: "Overdue loans", count: data.overdueLoans.length, to: T.returns },
    { label: "Reservation offers", count: data.offeredReservations.length, to: T.reservations },
    { label: "Pending COR reviews", count: data.pendingCorReviews, to: T.corReview },
  ];
  const total = data.awaitingRelease + data.onHold + data.overdueLoans.length + data.offeredReservations.length
    + (data.pendingCorReviews ?? 0);

  return (
    <div className="dashboard-layout">
      <div className="dashboard-kpi-strip">
        {kpis.map((item, index) => (
          <KpiCard key={item.label} {...item} index={index} />
        ))}
      </div>
      <div className="dashboard-grid-main">
        <ChartPanel title="Circulation in focus" note="Current workload from the staff dashboard response.">
          <div
            className="dashboard-segments"
            role="img"
            aria-label={`Current staff workload: ${attention.map((item) => `${item.label} ${item.count === null ? "not available" : item.count}`).join(", ")}`}
          >
            {[
              { label: "Awaiting release", value: data.awaitingRelease, tone: "forest" },
              { label: "On hold", value: data.onHold, tone: "amber" },
              { label: "Overdue loans", value: data.overdueLoans.length, tone: "brick" },
              { label: "Offers outstanding", value: data.offeredReservations.length, tone: "teal" },
              { label: "Pending COR reviews", value: data.pendingCorReviews, tone: "amber" },
            ].map((segment) => segment.value !== null && total > 0 ? (
              <span
                key={segment.label}
                className={`dashboard-segments__item dashboard-segments__item--${segment.tone}`}
                style={{ width: `${(segment.value / total) * 100}%` }}
                title={`${segment.label}: ${segment.value}`}
              />
            ) : null)}
          </div>
          <ul className="dashboard-segment-list">
            {attention.map((item, index) => (
              <li key={item.label}>
                <i className={`dashboard-legend-dot dashboard-legend-dot--${["forest", "amber", "brick", "teal", "amber"][index]}`} />
                <span>{item.label}</span>
                <b>{item.count === null ? "Not available yet" : item.count.toLocaleString()}</b>
              </li>
            ))}
          </ul>
        </ChartPanel>
        <ChartPanel title="Needs attention">
          <AttentionList items={attention} />
        </ChartPanel>
      </div>
    </div>
  );
}