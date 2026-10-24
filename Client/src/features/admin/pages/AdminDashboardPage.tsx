import { Link } from "react-router-dom";
import { useState } from "react";
import { PackageCheck, Scale, ScrollText, FileCheck, Undo2, UserCog } from "lucide-react";
import LoadingState from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as reportsService from "@/services/reportsService";
import OperationalCountCards from "@/features/dashboard/OperationalCountCards";
import { AdminKpiStrip, AdminMoneyFigure, ActivityHeatStrip, ChartPanel, RankedBars, RatioRing } from "@/features/dashboard/DashboardVisuals";
import { ActivityChart, CopyStatusDonut } from "@/features/admin/components/SystemActivityChart";

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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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
  const activeSelectedDay = selectedDay ?? d.activityLast7Days[d.activityLast7Days.length - 1]?.date ?? null;

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
        <div className="admin-dashboard__legacy-counts" aria-hidden="true"><OperationalCountCards /></div>
        <AdminKpiStrip data={d} />
        <section className="dashboard-shortcuts" aria-label="Administration shortcuts">
          {QUICK.slice(2).map(({ label, to, icon: Icon }) => (
            <Link key={to} to={to}>
              <Icon size={17} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </section>
        <div className="dashboard-grid-main admin-dashboard__charts">
          <ChartPanel title="Library activity" note="Loans issued and returns, day by day." className="dashboard-panel--feature admin-dashboard__activity-panel">
            <ActivityChart days={d.activityLast7Days} selectedDay={activeSelectedDay} onSelectDay={setSelectedDay} />
          </ChartPanel>
          <ChartPanel title="Copies by status" note="Collection distribution across copy states." className="admin-dashboard__copies-panel">
            <CopyStatusDonut counts={d.copiesByStatus} />
          </ChartPanel>
        </div>
        <div className="dashboard-grid-support admin-dashboard__support">
          <ChartPanel title="Most borrowed" note="Ranked titles by loan count." className="admin-dashboard__books-panel">
            <RankedBars books={d.popularBooks} />
          </ChartPanel>
          <ChartPanel title="Unpaid fines" note="Outstanding balance across unpaid and partially paid fines." className="admin-dashboard__fines-panel">
            <AdminMoneyFigure amount={d.unpaidFineBalance} to={ROUTES.admin.finesAndPayments} />
          </ChartPanel>
          <ChartPanel title="Overdue share" note="Overdue loans compared with active loans." className="admin-dashboard__ratio-panel">
            <RatioRing active={d.activeLoans} overdue={d.overdueLoans} />
          </ChartPanel>
        </div>
        <ChartPanel title="Seven-day intensity" note="Daily circulation volume across the same activity period." className="admin-dashboard__heat-panel">
          <ActivityHeatStrip days={d.activityLast7Days} selectedDay={activeSelectedDay} onSelectDay={setSelectedDay} />
        </ChartPanel>
      </div>
    </div>
  );
}
