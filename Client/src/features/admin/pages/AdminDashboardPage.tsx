import { Link } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as reportsService from "@/services/reportsService";
import AdminStats from "../components/AdminStats";
import { ActivityChart, CopyStatusBars } from "../components/SystemActivityChart";

const QUICK = [
  { label: "Books to Release", to: ROUTES.staff.booksToRelease },
  { label: "Returns and loans", to: ROUTES.staff.returns },
  { label: "COR review", to: ROUTES.admin.cor },
  { label: "Invite a Librarian", to: ROUTES.admin.librarians },
  { label: "Audit logs", to: ROUTES.admin.auditLogs },
  { label: "Borrowing policies", to: ROUTES.admin.policies },
];

// GET /admin/dashboard (D1). Admin can also open every Librarian screen from here.
export default function AdminDashboardPage() {
  const dash = useAsync(() => reportsService.getAdminDashboard(), []);
  if (dash.loading && !dash.data) return <div className="page"><LoadingState rows={5} /></div>;
  if (dash.error || !dash.data) return <div className="page"><ErrorState message={dash.error ?? "Could not load the dashboard."} onRetry={() => void dash.reload()} /></div>;
  const d = dash.data;

  return (
    <div className="page">
      <PageHeader eyebrow="Admin" title="Admin dashboard" description="System overview. Admin can run every Librarian operation plus the administrative tools." />
      <div className="stack">
        {d.pendingCorReviews > 0 && (
          <Alert kind="warn">
            {d.pendingCorReviews} COR {d.pendingCorReviews === 1 ? "submission is" : "submissions are"} waiting. <Link to={ROUTES.admin.cor}>Review now</Link>
          </Alert>
        )}
        <AdminStats data={d} />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Activity, last 7 days" note="Sample statistics in this demo (TC-16).">
            <ActivityChart days={d.activityLast7Days} />
          </Card>
          <Card title="Copies by status" note="Computed live from the copy records.">
            <CopyStatusBars counts={d.copiesByStatus} />
          </Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Most borrowed">
            <ol style={{ paddingLeft: 18, display: "grid", gap: 6 }}>
              {d.popularBooks.map((b) => (
                <li key={b.bookId}>
                  <Link to={ROUTES.student.bookDetails(b.bookId)}>{b.title}</Link> <span className="subtle">· {b.loanCount} loans</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Quick links">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {QUICK.map((q) => (
                <Link key={q.to} to={q.to} className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>
                  {q.label}
                </Link>
              ))}
              <p>trash</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}