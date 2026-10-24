import { Link } from "react-router-dom";
import { PackageCheck, Scale, ScrollText, FileCheck, Undo2, UserCog } from "lucide-react";
import StatCard from "@/components/data-display/StatCard";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
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
  return (
    <div className="page">
      <PageHeader eyebrow="Admin" title="Admin dashboard" description="Live circulation counts and administration shortcuts." />
      <div className="stack">
        <OperationalCountCards />
        <div className="grid-auto" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          <StatCard label="Students" value="Not available yet" />
          <StatCard label="Librarians" value="Not available yet" />
          <StatCard label="Overdue loans" value="Not available yet" />
          <StatCard label="Unpaid fine balance" value="Not available yet" />
          <StatCard label="Copy status breakdown" value="Not available yet" />
          <StatCard label="Activity statistics" value="Not available yet" />
          <StatCard label="Most borrowed books" value="Not available yet" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
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