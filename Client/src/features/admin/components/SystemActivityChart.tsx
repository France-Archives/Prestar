import type { AdminDashboardData, BookCopyStatus } from "@/types";
import { statusLabel } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";

type Day = AdminDashboardData["activityLast7Days"][number];

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#10b981", // emerald
  ON_LOAN: "#3b82f6", // blue
  RESERVED: "#6366f1", // indigo
  MAINTENANCE: "#f59e0b", // amber
  DAMAGED: "#f97316", // orange
  LOST: "#ef4444", // red
  WITHDRAWN: "#64748b", // slate
};

export function ActivityChart({ days }: { days: Day[] }) {
  const max = Math.max(1, ...days.flatMap((d) => [d.loansIssued, d.returns]));
  const totalIssued = days.reduce((acc, d) => acc + d.loansIssued, 0);
  const totalReturned = days.reduce((acc, d) => acc + d.returns, 0);

  return (
    <div className="space-y-4">
      {/* Top summary row */}
      <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#296148]" />
            <span className="font-medium text-slate-700">Issued ({totalIssued})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#e09f3e]" />
            <span className="font-medium text-slate-700">Returned ({totalReturned})</span>
          </div>
        </div>
        <span className="text-[11px] text-slate-400">Past 7 days</span>
      </div>

      {/* Modern minimal chart bars */}
      <div
        className="flex items-end justify-between gap-2 sm:gap-3 h-36 pt-4"
        role="img"
        aria-label="Loans issued and returns for the last 7 days"
      >
        {days.map((d) => {
          const issuedHeight = Math.max(4, Math.round((d.loansIssued / max) * 100));
          const returnHeight = Math.max(4, Math.round((d.returns / max) * 100));

          return (
            <div
              key={d.date}
              className="group flex-1 flex flex-col items-center justify-end h-full gap-1 relative"
            >
              {/* Tooltip on hover */}
              <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#1f4b37] px-2 py-1 text-[10px] font-medium text-white shadow-lg z-20 transition-opacity">
                <span>{formatDate(d.date)}:</span>
                <span className="text-white font-bold">{d.loansIssued} issued</span>
                <span>/</span>
                <span className="text-amber-200 font-bold">{d.returns} ret</span>
              </div>

              {/* Dual bars */}
              <div className="flex items-end justify-center gap-1 w-full h-full">
                <div
                  style={{ height: `${issuedHeight}%` }}
                  className="w-1/2 max-w-[14px] bg-[#296148] rounded-t-sm transition-all duration-300 hover:brightness-125"
                />
                <div
                  style={{ height: `${returnHeight}%` }}
                  className="w-1/2 max-w-[14px] bg-[#e09f3e] rounded-t-sm transition-all duration-300 hover:brightness-110"
                />
              </div>

              {/* Day label */}
              <span className="text-[10px] font-medium text-slate-400 truncate mt-1">
                {d.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CopyStatusBars({ counts }: { counts: Record<BookCopyStatus, number> }) {
  const entries = Object.entries(counts) as [BookCopyStatus, number][];
  const total = Math.max(1, entries.reduce((acc, [, n]) => acc + n, 0));

  return (
    <div className="space-y-3">
      {entries.map(([status, n]) => {
        const pct = Math.round((n / total) * 100);
        const color = STATUS_COLORS[status] ?? "#64748b";

        return (
          <div key={status} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-medium text-slate-700">{statusLabel(status)}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                <span className="font-semibold text-slate-900">{n}</span>
                <span className="text-slate-400">({pct}%)</span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}