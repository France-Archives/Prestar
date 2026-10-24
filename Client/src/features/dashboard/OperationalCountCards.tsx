import Alert from "@/components/feedback/Alert";
import StatCard from "@/components/data-display/StatCard";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { getOperationalDashboardCounts } from "@/services/dashboardService";

const CARDS = [
  { key: "pendingRequests", label: "Pending borrow requests", to: ROUTES.staff.requests },
  { key: "booksToRelease", label: "Books to release", to: ROUTES.staff.booksToRelease },
  { key: "activeLoans", label: "Active loans", to: ROUTES.staff.returns },
  { key: "pendingCor", label: "Pending COR", to: ROUTES.staff.corReview },
  { key: "waitingReservations", label: "Waiting reservations", to: ROUTES.staff.reservations },
] as const;

export default function OperationalCountCards() {
  const counts = useAsync(getOperationalDashboardCounts, []);

  return (
    <div className="grid-auto" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
      {CARDS.map(({ key, label, to }) => {
        const result = counts.data?.[key];
        const value = counts.loading && !counts.data
          ? "…"
          : result?.error
            ? "-"
            : result?.value ?? "-";

        return (
          <div className="stack" key={key}>
            <StatCard label={label} value={value} to={to} />
            {result?.error && <Alert kind="error">{result.error}</Alert>}
          </div>
        );
      })}
    </div>
  );
}
