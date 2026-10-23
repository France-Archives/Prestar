import { Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import type { AdminDashboardData } from "@/types";
import { formatPeso } from "@/utils/formatCurrency";

interface AdminStatsProps {
  data: AdminDashboardData;
}

export default function AdminStats({ data }: AdminStatsProps) {
  const A = ROUTES.admin;
  const T = ROUTES.staff;

  const stats = [
    {
      label: "Registered Students",
      value: data.totalStudents,
      to: A.users,
      badge: "Accounts",
      badgeTone: "neutral",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: "Librarian Staff",
      value: data.totalLibrarians,
      to: A.librarians,
      badge: "Team",
      badgeTone: "neutral",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
        </svg>
      ),
    },
    {
      label: "Active Loans",
      value: data.activeLoans,
      to: T.returns,
      badge: "Circulation",
      badgeTone: "ok",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M12 7v6" />
          <path d="M9 10h6" />
        </svg>
      ),
    },
    {
      label: "Overdue Loans",
      value: data.overdueLoans,
      to: T.returns,
      alert: data.overdueLoans > 0,
      badge: data.overdueLoans > 0 ? "Requires Action" : "Clear",
      badgeTone: data.overdueLoans > 0 ? "danger" : "ok",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: "Pending COR Reviews",
      value: data.pendingCorReviews,
      to: A.cor,
      alert: data.pendingCorReviews > 0,
      badge: data.pendingCorReviews > 0 ? "Pending" : "Reviewed",
      badgeTone: data.pendingCorReviews > 0 ? "warn" : "ok",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" x2="8" y1="13" y2="13" />
          <line x1="16" x2="8" y1="17" y2="17" />
        </svg>
      ),
    },
    {
      label: "Unpaid Fine Balance",
      value: formatPeso(data.unpaidFineBalance),
      to: A.finesAndPayments,
      badge: "Receivables",
      badgeTone: "neutral",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
      {stats.map((s) => (
        <Link
          key={s.label}
          to={s.to}
          className={`group flex flex-col justify-between rounded-xl border p-4 bg-white shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs no-underline ${
            s.alert ? "border-amber-200/90 bg-amber-50/20" : "border-slate-200/90"
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                s.alert
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-700 group-hover:bg-[#296148] group-hover:text-white"
              } transition-colors`}
            >
              {s.icon}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                s.badgeTone === "danger"
                  ? "bg-rose-50 text-rose-700 ring-1 ring-rose-600/10"
                  : s.badgeTone === "warn"
                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/10"
                  : s.badgeTone === "ok"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {s.badge}
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 group-hover:text-slate-700 leading-tight">
              {s.value}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1 truncate">
              {s.label}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}