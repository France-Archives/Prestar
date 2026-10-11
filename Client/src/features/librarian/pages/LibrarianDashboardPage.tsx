import { Link, useNavigate } from "react-router-dom";
import Card from "@/components/ui/Card";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import * as reportsService from "@/services/reportsService";
import type { StaffLoan } from "@/types";
import { formatDate } from "@/utils/formatDate";
import CirculationStats from "../components/CirculationStats";
import RequestQueueTable from "../components/RequestQueueTable";
import ReservationQueue from "../components/ReservationQueue";

// Admin also sees this dashboard (Admin = Librarian + Admin-only). KPI definitions are TO CONFIRM (TC-16).
export default function LibrarianDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dash = useAsync(() => reportsService.getStaffDashboard(), []);

  if (dash.loading) return <div className="page"><LoadingState rows={5} /></div>;
  if (dash.error || !dash.data) return <div className="page"><ErrorState message={dash.error ?? "Could not load the dashboard."} onRetry={() => void dash.reload()} /></div>;
  const d = dash.data;

  const overdueColumns: Column<StaffLoan>[] = [
    { key: "student", header: "Student", render: (l) => `${l.student.firstName} ${l.student.lastName}` },
    { key: "bookTitle", header: "Book" },
    { key: "dueAt", header: "Due", render: (l) => formatDate(l.dueAt) },
    { key: "overdueDays", header: "Days overdue" },
    // Display only: the backend decides the restriction (more than 3 calendar days overdue).
    { key: "restricted", header: "Restricted", render: (l) => (l.overdueDays > 3 ? "Yes" : "Grace period") },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow={user?.role === "ADMIN" ? "Admin · staff view" : "Librarian"}
        title="Circulation dashboard"
        description="Books waiting for release, overdue loans and offers outstanding."
        actions={
          <Link to={ROUTES.staff.booksToRelease} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }}>
            Books to Release
          </Link>
        }
      />
      <div className="stack">
        <CirculationStats data={d} />
        <Card title="Books to Release" note="Approved requests and held pickups, earliest deadline first.">
          <RequestQueueTable rows={d.booksToRelease} pageSize={5} onOpen={(r) => navigate(ROUTES.staff.handover(r.requestId))} />
        </Card>
        <Card title="Overdue loans">
          <DataTable columns={overdueColumns} rows={d.overdueLoans} rowKey={(l) => l.id} empty="No overdue loans." pageSize={5} />
        </Card>
        <Card title="Offered reservations" note="A copy is held for these students.">
          <ReservationQueue rows={d.offeredReservations} empty="No offers outstanding." />
        </Card>
      </div>
    </div>
  );
}