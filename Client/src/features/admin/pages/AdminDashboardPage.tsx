import { Link } from "react-router-dom";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as reportsService from "@/services/reportsService";
import AdminStats from "../components/AdminStats";
import { ActivityChart, CopyStatusBars } from "../components/SystemActivityChart";

const QUICK_ACTIONS = [
  {
    label: "Books to Release",
    desc: "Confirm handovers & check student eligibility",
    to: ROUTES.staff.booksToRelease,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
        <polyline points="10 2 10 10 13 7 16 10 16 2" />
      </svg>
    ),
  },
  {
    label: "Returns & Check-in",
    desc: "Inspect returned copies, mark lost or fine",
    to: ROUTES.staff.returns,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    ),
  },
  {
    label: "COR Review Queue",
    desc: "Verify Certificate of Registration uploads",
    to: ROUTES.admin.cor,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    label: "Invite Librarian",
    desc: "Add staff accounts & set permissions",
    to: ROUTES.admin.librarians,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" x2="19" y1="8" y2="14" />
        <line x1="22" x2="16" y1="11" y2="11" />
      </svg>
    ),
  },
  {
    label: "Audit Logs",
    desc: "Inspect chronological system actions",
    to: ROUTES.admin.auditLogs,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      </svg>
    ),
  },
  {
    label: "Borrowing Policies",
    desc: "Configure loan limits, hold windows & renewals",
    to: ROUTES.admin.policies,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="4" x2="20" y1="9" y2="9" />
        <line x1="4" x2="20" y1="15" y2="15" />
        <line x1="10" x2="10" y1="3" y2="21" />
      </svg>
    ),
  },
];

export default function AdminDashboardPage() {
  const dash = useAsync(() => reportsService.getAdminDashboard(), []);

  if (dash.loading && !dash.data) {
    return (
      <div className="page">
        <LoadingState rows={5} />
      </div>
    );
  }

  if (dash.error || !dash.data) {
    return (
      <div className="page">
        <ErrorState
          message={dash.error ?? "Could not load the admin dashboard."}
          onRetry={() => void dash.reload()}
        />
      </div>
    );
  }

  const d = dash.data;

  return (
    <div className="page space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Executive Console
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-emerald-600/10">
              Live Overview
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            System Administration
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Holistic management of users, circulation, library assets, policies, and audit records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={ROUTES.admin.reports}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-colors no-underline"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
            <span>View Reports</span>
          </Link>
          <Link
            to={ROUTES.admin.users}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#296148] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#1f4b37] transition-colors no-underline"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <span>Manage Users</span>
          </Link>
        </div>
      </div>

      {/* Urgent Alert Banner */}
      {d.pendingCorReviews > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
            </span>
            <div>
              <div className="text-sm font-semibold text-amber-900">
                {d.pendingCorReviews} Pending COR {d.pendingCorReviews === 1 ? "Verification" : "Verifications"}
              </div>
              <p className="text-xs text-amber-700/90 mt-0.5">
                Students awaiting Certificate of Registration approval to unlock borrowing privileges.
              </p>
            </div>
          </div>
          <Link
            to={ROUTES.admin.cor}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-amber-700 transition-colors no-underline"
          >
            <span>Review Now</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>
      )}

      {/* Key Metrics Grid */}
      <AdminStats data={d} />

      {/* Analytics: Activity & Inventory */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Circulation Activity"
          note="Loans issued vs. returns over the past 7 days."
        >
          <ActivityChart days={d.activityLast7Days} />
        </Card>

        <Card
          title="Physical Inventory by Status"
          note="Live copy status breakdown across the library catalog."
        >
          <CopyStatusBars counts={d.copiesByStatus} />
        </Card>
      </div>

      {/* Popular Books & Operational Shortcuts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Most Borrowed Books" note="Top circulated titles across all academic programs.">
          {d.popularBooks.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No borrowing records yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {d.popularBooks.map((b, idx) => (
                <div key={b.bookId} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        idx === 0
                          ? "bg-amber-100 text-amber-800"
                          : idx === 1
                          ? "bg-slate-200 text-slate-700"
                          : idx === 2
                          ? "bg-orange-100 text-orange-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <Link
                      to={ROUTES.student.bookDetails(b.bookId)}
                      className="text-xs font-semibold text-slate-900 hover:text-[#296148] truncate no-underline transition-colors"
                    >
                      {b.title}
                    </Link>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60 ml-2">
                    {b.loanCount} {b.loanCount === 1 ? "loan" : "loans"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Operational Shortcuts" note="Quick administrative access to core operational screens.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {QUICK_ACTIONS.map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="group flex flex-col justify-between rounded-lg border border-slate-200/80 p-3 bg-white hover:border-slate-300 hover:bg-slate-50/70 transition-all no-underline"
              >
                <div className="flex items-center gap-2 text-slate-700 group-hover:text-slate-900 mb-1">
                  <span className="text-slate-400 group-hover:text-slate-700 transition-colors">
                    {q.icon}
                  </span>
                  <span className="text-xs font-semibold leading-tight">{q.label}</span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1 leading-normal m-0">
                  {q.desc}
                </p>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}