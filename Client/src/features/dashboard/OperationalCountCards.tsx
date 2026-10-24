import Alert from "@/components/feedback/Alert";
import {
  AttentionList,
  ChartPanel,
  KpiCard,
} from "@/features/dashboard/DashboardVisuals";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { getOperationalDashboardCounts } from "@/services/dashboardService";
import { Activity, BookOpenCheck, ClipboardCheck, PackageCheck, UsersRound } from "lucide-react";

const CARDS = [
  { key: "pendingRequests", label: "Pending requests", to: ROUTES.staff.requests, icon: ClipboardCheck, tone: "amber" },
  { key: "booksToRelease", label: "Books to release", to: ROUTES.staff.booksToRelease, icon: PackageCheck, tone: "forest" },
  { key: "activeLoans", label: "Active loans", to: ROUTES.staff.returns, icon: BookOpenCheck, tone: "green" },
  { key: "pendingCor", label: "Pending COR", to: ROUTES.staff.corReview, icon: UsersRound, tone: "brick" },
  { key: "waitingReservations", label: "Waiting reservations", to: ROUTES.staff.reservations, icon: Activity, tone: "amber" },
] as const;

export default function OperationalCountCards() {
  const counts = useAsync(getOperationalDashboardCounts, []);
  const attention = CARDS.map(({ key, label, to }) => ({
    label,
    to,
    count: counts.data?.[key]?.error ? null : counts.data?.[key]?.value ?? null,
  }));
  const segments = CARDS.map(({ key, label, tone }) => ({
    label,
    tone,
    value: counts.data?.[key]?.error ? null : counts.data?.[key]?.value ?? null,
  }));
  const total = segments.reduce((sum, segment) => sum + (segment.value ?? 0), 0);

  return (
    <div className="dashboard-layout">
      <div className="dashboard-kpi-strip">
        {CARDS.map(({ key, label, to, icon: Icon, tone }, index) => {
        const result = counts.data?.[key];
        const value = counts.loading && !counts.data
          ? "Loading"
          : result?.error
            ? "Not available yet"
            : result?.value ?? "Not available yet";

        return (
          <div className="stack" key={key}>
            <KpiCard icon={Icon} label={label} value={value} to={to} tone={tone} index={index} />
            {result?.error && <Alert kind="error">{result.error}</Alert>}
          </div>
        );
        })}
      </div>
      <div className="dashboard-grid-main">
        <ChartPanel title="Circulation at a glance" note="Relative proportions for counts currently available.">
          {segments.some((segment) => segment.value !== null) ? (
            <>
              <div
                className="dashboard-segments"
                role="img"
                aria-label={`Operational counts: ${segments.map((segment) => `${segment.label} ${segment.value === null ? "not available" : segment.value}`).join(", ")}`}
              >
                {segments.map((segment) => segment.value !== null && total > 0 ? (
                  <span
                    key={segment.label}
                    className={`dashboard-segments__item dashboard-segments__item--${segment.tone}`}
                    style={{ width: `${(segment.value / total) * 100}%` }}
                    title={`${segment.label}: ${segment.value}`}
                  />
                ) : null)}
              </div>
              <ul className="dashboard-segment-list">
                {segments.map((segment) => (
                  <li key={segment.label}>
                    <i className={`dashboard-legend-dot dashboard-legend-dot--${segment.tone}`} />
                    <span>{segment.label}</span>
                    <b>{segment.value === null ? "Not available yet" : segment.value.toLocaleString()}</b>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="dashboard-attention__empty">Operational counts are not available yet.</p>
          )}
        </ChartPanel>
        <ChartPanel title="Needs attention">
          <AttentionList items={attention} />
        </ChartPanel>
      </div>
    </div>
  );
}
