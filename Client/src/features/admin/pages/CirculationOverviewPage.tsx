import { Link } from "react-router-dom";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import CirculationStats from "@/features/librarian/components/CirculationStats";
import RequestQueueTable from "@/features/librarian/components/RequestQueueTable";
import { useAsync } from "@/hooks/useAsync";
import * as reportsService from "@/services/reportsService";
import { useNavigate } from "react-router-dom";

const T = ROUTES.staff;
const SCREENS = [
  ["Books to Release", T.booksToRelease, "Check Penalties and confirm handovers."],
  ["Borrowing requests", T.requests, "Cancel or expire requests."],
  ["Returns and loans", T.returns, "Confirm returns, mark lost."],
  ["Reservations queue", T.reservations, "FIFO queue and offered copies."],
  ["Renewals", T.renewals, "Automatic renewal history."],
  ["Check Penalties", T.penaltyCheck, "Live eligibility lookup."],
  ["Fines", ROUTES.admin.finesAndPayments, "Assess, record payments, waive."],
  ["Maintenance copies", T.maintenance, "Damaged, lost and withdrawn copies."],
] as const;

// Admin = Librarian + Admin-only, so every circulation screen is one click away.
export default function CirculationOverviewPage() {
  const navigate = useNavigate();
  const dash = useAsync(() => reportsService.getStaffDashboard(), []);
  return (
    <div className="page">
      <PageHeader eyebrow="Administration" title="Circulation overview" description="Everything a Librarian can do, available to Admin." />
      <div className="stack">
        {dash.loading && !dash.data ? <LoadingState rows={2} /> : dash.error || !dash.data ? <ErrorState message={dash.error ?? ""} onRetry={() => void dash.reload()} /> : (
          <>
            <CirculationStats data={dash.data} />
            <Card title="Books to Release" padded={false}>
              <RequestQueueTable rows={dash.data.booksToRelease} pageSize={5} onOpen={(r) => navigate(T.handover(r.requestId))} />
            </Card>
          </>
        )}
        <Card title="Circulation screens">
          <div className="grid-auto">
            {SCREENS.map(([label, to, note]) => (
              <Link key={to} to={to} className="card card-pad" style={{ textDecoration: "none" }}>
                <b style={{ color: "var(--color-forest)" }}>{label}</b>
                <p className="subtle">{note}</p>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}