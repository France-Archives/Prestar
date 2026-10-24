import { Link } from "react-router-dom";
import { Activity, LibraryBig, PackageCheck, Scale, ScrollText, FileCheck, Undo2, UserCog, UsersRound } from "lucide-react";
import Alert from "@/components/feedback/Alert";
import LoadingState from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as reportsService from "@/services/reportsService";
import OperationalCountCards from "@/features/dashboard/OperationalCountCards";
import { ChartPanel, KpiCard, RankedBars, RatioRing } from "@/features/dashboard/DashboardVisuals";
import { ActivityChart, CopyStatusDonut } from "@/features/admin/components/SystemActivityChart";
import { formatPeso } from "@/utils/formatCurrency";

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
        <PageHero
          eyebrow="Admin"
          title="Dashboard"
          description="Live circulation counts and administration shortcuts."
          leading={<BackButton fallback={ROUTES.admin.dashboard} />}
        />
        <LoadingState rows={5} />
      </div>
    );
  }

  if (dash.error || !dash.data) {
    return (
      <div className="page">
        <PageHero
          eyebrow="Admin"
          title="Dashboard"
          description="Live circulation counts and administration shortcuts."
          leading={<BackButton fallback={ROUTES.admin.dashboard} />}
        />
        <ErrorState message={dash.error ?? "Could not load the dashboard."} onRetry={() => void dash.reload()} />
      </div>
    );
  }

  const d = dash.data;

  return (
    <div className="page">
      <PageHero
        eyebrow="Admin"
        title="Dashboard"
        description="Live circulation counts and administration shortcuts."
        leading={<BackButton fallback={ROUTES.admin.dashboard} />}
        actions={<div className="dashboard-actions">{QUICK.slice(0, 2).map(({ label, to }) => <Link key={to} to={to}>{label}</Link>)}</div>}
      />
      <div className="dashboard-layout">
        <OperationalCountCards />
        {d.pendingCorReviews > 0 && (
          <Alert kind="warn">
            {d.pendingCorReviews} COR {d.pendingCorReviews === 1 ? "submission is" : "submissions are"} waiting.{" "}
            <Link to={ROUTES.staff.corReview}>Review now</Link>
          </Alert>
        )}
        <div className="dashboard-kpi-strip">
          <KpiCard icon={UsersRound} label="Students" value={d.totalStudents} to={ROUTES.admin.users} tone="forest" index={0} />
          <KpiCard icon={LibraryBig} label="Librarians" value={d.totalLibrarians} to={ROUTES.admin.librarians} tone="teal" index={1} />
          <KpiCard icon={Activity} label="Overdue loans" value={d.overdueLoans} to={ROUTES.staff.returns} tone="brick" index={2} />
        </div>
        <section className="dashboard-shortcuts" aria-label="Administration shortcuts">
          {QUICK.slice(2).map(({ label, to, icon: Icon }) => (
            <Link key={to} to={to}>
              <Icon size={17} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </section>
        <div className="dashboard-grid-main">
          <ChartPanel title="Library activity" note="Loans issued and returns, day by day." className="dashboard-panel--feature">
            <ActivityChart days={d.activityLast7Days} />
          </ChartPanel>
          <ChartPanel title="Copies by status" note="Collection distribution across copy states.">
            <CopyStatusDonut counts={d.copiesByStatus} />
          </ChartPanel>
        </div>
        <div className="dashboard-grid-support">
          <ChartPanel title="Most borrowed" note="Ranked titles by loan count.">
            <RankedBars books={d.popularBooks} />
          </ChartPanel>
          <ChartPanel title="Unpaid fines" note="Outstanding balance across unpaid and partially paid fines.">
            <div className="dashboard-focal-figure">
              <strong>{formatPeso(d.unpaidFineBalance)}</strong>
              <Link to={ROUTES.admin.finesAndPayments}>Review fines and payments</Link>
            </div>
          </ChartPanel>
          <ChartPanel title="Overdue share" note="Overdue loans compared with active loans.">
            <RatioRing active={d.activeLoans} overdue={d.overdueLoans} />
          </ChartPanel>
        </div>
      </div>
    </div>
  );
}
