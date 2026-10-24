import { Link } from "react-router-dom";
import { Activity, LibraryBig, PackageCheck, Scale, ScrollText, FileCheck, Undo2, UserCog } from "lucide-react";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import OperationalCountCards from "@/features/dashboard/OperationalCountCards";
import { ChartPanel, KpiCard, RankedBars, RatioRing } from "@/features/dashboard/DashboardVisuals";
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
  return (
    <div className="page">
      <PageHero
        eyebrow="Admin"
        title="Admin dashboard"
        description="Live circulation counts and administration shortcuts."
        leading={<BackButton fallback={ROUTES.admin.dashboard} />}
        actions={<div className="dashboard-actions">{QUICK.slice(0, 2).map(({ label, to }) => <Link key={to} to={to}>{label}</Link>)}</div>}
      />
      <div className="dashboard-layout">
        <OperationalCountCards />
        <div className="dashboard-kpi-strip">
          <KpiCard icon={PackageCheck} label="Students" value="Not available yet" to={ROUTES.admin.users} tone="forest" index={0} />
          <KpiCard icon={LibraryBig} label="Librarians" value="Not available yet" to={ROUTES.admin.librarians} tone="teal" index={1} />
          <KpiCard icon={Activity} label="Overdue loans" value="Not available yet" to={ROUTES.staff.returns} tone="brick" index={2} />
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
            <ActivityChart days={null} />
          </ChartPanel>
          <ChartPanel title="Copies by status" note="Collection distribution across copy states.">
            <CopyStatusDonut counts={null} />
          </ChartPanel>
        </div>
        <div className="dashboard-grid-support">
          <ChartPanel title="Most borrowed" note="Ranked titles by loan count.">
            <RankedBars books={null} />
          </ChartPanel>
          <ChartPanel title="Unpaid fines" note="Outstanding balance across unpaid and partially paid fines.">
            <div className="dashboard-focal-figure">
              <strong>Not available yet</strong>
              <Link to={ROUTES.admin.finesAndPayments}>Review fines and payments</Link>
            </div>
          </ChartPanel>
          <ChartPanel title="Overdue share" note="Overdue loans compared with active loans.">
            <RatioRing active={null} overdue={null} />
          </ChartPanel>
        </div>
      </div>
    </div>
  );
}