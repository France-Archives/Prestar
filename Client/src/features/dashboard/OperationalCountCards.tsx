import Alert from "@/components/feedback/Alert";
import {
  AttentionList,
  ChartPanel,
  DashboardNumber,
} from "@/features/dashboard/DashboardVisuals";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { getOperationalDashboardCounts } from "@/services/dashboardService";
import { Activity, BookOpenCheck, ClipboardCheck, PackageCheck, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import type { CSSProperties } from "react";

const CARDS = [
  { key: "pendingRequests", label: "Pending requests", to: ROUTES.staff.requests, tone: "amber", focal: false },
  { key: "booksToRelease", label: "Books to release", to: ROUTES.staff.booksToRelease, tone: "forest", focal: false },
  { key: "activeLoans", label: "Active loans", to: ROUTES.staff.returns, tone: "green", focal: false },
  { key: "pendingCor", label: "Pending COR", to: ROUTES.staff.corReview, tone: "brick", focal: true },
  { key: "waitingReservations", label: "Waiting reservations", to: ROUTES.staff.reservations, tone: "amber", focal: false },
] as const;

const ICONS = {
  pendingRequests: ClipboardCheck,
  booksToRelease: PackageCheck,
  activeLoans: BookOpenCheck,
  pendingCor: UsersRound,
  waitingReservations: Activity,
} as const;

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
  const maxCount = Math.max(1, ...segments.map((segment) => segment.value ?? 0));

  return (
    <div className="librarian-dashboard">
      <div className="librarian-dashboard__instruments" role="group" aria-label="Library operational metrics">
        {CARDS.map(({ key, label, to, tone, focal }, index) => {
          const result = counts.data?.[key];
          const Icon = ICONS[key];
          const value = result?.error
            ? "Not available"
            : result?.value;
          const content = (
            <>
              <span className="librarian-dashboard__metric-label">
                <i className={`dashboard-legend-dot dashboard-legend-dot--${tone}`} />
                {label}
              </span>
              <strong className="librarian-dashboard__metric-value">
                {counts.loading && !counts.data
                  ? <span className="librarian-dashboard__loading">—</span>
                  : typeof value === "number"
                    ? <DashboardNumber value={value} />
                    : value}
              </strong>
              <span className="librarian-dashboard__metric-caption">
                <Icon size={14} aria-hidden="true" />
                {focal ? "Review student records" : "Open this work queue"}
              </span>
            </>
          );

          return (
            <div
              className={`librarian-dashboard__metric${focal ? " librarian-dashboard__metric--focal" : ""}`}
              key={key}
              style={{ "--i": index } as CSSProperties}
            >
              {focal
                ? <div>{content}<Link to={to} aria-label="Review pending COR"><span>Review now</span><span aria-hidden="true">→</span></Link></div>
                : <Link to={to}>{content}</Link>}
              {result?.error && <Alert kind="error">{result.error}</Alert>}
            </div>
          );
        })}
      </div>

      <div className="dashboard-grid-main librarian-dashboard__panels">
        <ChartPanel title="Queue pulse" note="Independent work queues currently available to the library team.">
          {segments.some((segment) => segment.value !== null) ? (
            <ul className="librarian-dashboard__queue-pulse">
              {segments.map((segment, index) => (
                <li key={segment.label} style={{ "--i": index } as CSSProperties}>
                  <div>
                    <i className={`dashboard-legend-dot dashboard-legend-dot--${segment.tone}`} />
                    <span>{segment.label}</span>
                    <b>{segment.value === null ? "Unavailable" : segment.value.toLocaleString()}</b>
                  </div>
                  <span className="librarian-dashboard__queue-track" aria-hidden="true">
                    <i style={{ "--queue-progress": segment.value === null ? 0 : segment.value / maxCount } as CSSProperties} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-attention__empty">Operational counts are not available yet.</p>
          )}
        </ChartPanel>
        <ChartPanel title="Needs attention" note="Queues with work waiting for the library team.">
          <AttentionList items={attention} />
        </ChartPanel>
      </div>
    </div>
  );
}
