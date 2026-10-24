import { Link } from "react-router-dom";
import { PackageCheck, Scale, ScrollText, FileCheck, Undo2, UserCog } from "lucide-react";
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
import OperationalCountCards from "@/features/dashboard/OperationalCountCards";

const QUICK = [
  { label: "Books to Release", to: ROUTES.staff.booksToRelease, icon: PackageCheck },
  { label: "Returns and loans", to: ROUTES.staff.returns, icon: Undo2 },
  { label: "COR review", to: ROUTES.staff.corReview, icon: FileCheck },
  { label: "Invite a Librarian", to: ROUTES.admin.librarians, icon: UserCog },
  { label: "Audit logs", to: ROUTES.admin.auditLogs, icon: ScrollText },
  { label: "Borrowing policies", to: ROUTES.admin.policies, icon: Scale },
];

export default function AdminDashboardPage() {
  const dash = useAsync(() => reportsService.getAdminDashboard(), []);

  if (dash.loading && !dash.data) {
    return (
      <div className="page">
        <PageHeader eyebrow="Admin" title="Admin dashboard" description="Live circulation counts and administration shortcuts." />
        <LoadingState rows={5} />
      </div>
    );
  }

  if (dash.error || !dash.data) {
    return (
      <div className="page">
        <PageHeader eyebrow="Admin" title="Admin dashboard" description="Live circulation counts and administration shortcuts." />
        <ErrorState message={dash.error ?? "Could not load the dashboard."} onRetry={() => void dash.reload()} />
      </div>
    );
  }

  const d = dash.data;

  return (
    <div className="page">
      <PageHeader eyebrow="Admin" title="Admin dashboard" description="Live circulation counts and administration shortcuts." />
      <div className="stack">
        <OperationalCountCards />

        {d.pendingCorReviews > 0 && (
          <Alert kind="warn">
            {d.pendingCorReviews} COR {d.pendingCorReviews === 1 ? "submission is" : "submissions are"} waiting.{" "}
            <Link to={ROUTES.staff.corReview}>Review now</Link>
          </Alert>
        )}

        <AdminStats data={d} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Activity, last 7 days" note="Circulation activity over the last 7 days.">
            <ActivityChart days={d.activityLast7Days} />
          </Card>
          <Card title="Copies by status" note="Computed live from copy records.">
            <CopyStatusBars counts={d.copiesByStatus} />
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Most borrowed">
            <ol className="rank-list">
              {d.popularBooks.map((b, i) => (
                <li key={b.bookId}>
                  <span className="rank-list__n">{i + 1}</span>
                  <Link to={ROUTES.student.bookDetails(b.bookId)}>{b.title}</Link>
                  <span className="subtle">{b.loanCount} loans</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Quick links">
            <div className="quick-links">
              {QUICK.map(({ label, to, icon: Icon }) => (
                <Link key={to} to={to} className="quick-link">
                  <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}