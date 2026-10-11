import type { AdminDashboardData, BookCopyStatus } from "@/types";
import { statusLabel } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";

type Day = AdminDashboardData["activityLast7Days"][number];

// Simple CSS bars, no chart library. TEMPORARY MOCK: the 7-day figures are fixed sample data (KPI definitions are TO CONFIRM, TC-16).
export function ActivityChart({ days }: { days: Day[] }) {
  const max = Math.max(1, ...days.flatMap((d) => [d.loansIssued, d.returns]));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 150 }} role="img" aria-label="Loans issued and returns for the last 7 days">
        {days.map((d) => (
          <div key={d.date} style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3, height: "100%" }} title={`${formatDate(d.date)}: ${d.loansIssued} issued, ${d.returns} returned`}>
            <div style={{ width: "40%", height: `${(d.loansIssued / max) * 100}%`, background: "var(--color-forest)", borderRadius: "4px 4px 0 0", minHeight: 2 }} />
            <div style={{ width: "40%", height: `${(d.returns / max) * 100}%`, background: "var(--color-amber)", borderRadius: "4px 4px 0 0", minHeight: 2 }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        {days.map((d) => (
          <span key={d.date} className="subtle" style={{ flex: 1, textAlign: "center", fontSize: "0.6875rem" }}>
            {d.date.slice(5)}
          </span>
        ))}
      </div>
      <p className="subtle" style={{ marginTop: 8 }}>
        <span style={{ color: "var(--color-forest)" }}>■</span> Loans issued · <span style={{ color: "var(--color-amber)" }}>■</span> Returns
      </p>
    </div>
  );
}

export function CopyStatusBars({ counts }: { counts: Record<BookCopyStatus, number> }) {
  const entries = Object.entries(counts) as [BookCopyStatus, number][];
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return (
    <div className="stack" style={{ gap: 8 }}>
      {entries.map(([status, n]) => (
        <div key={status} style={{ display: "grid", gridTemplateColumns: "120px 1fr 32px", gap: 10, alignItems: "center", fontSize: "0.8125rem" }}>
          <span>{statusLabel(status)}</span>
          <div style={{ background: "var(--color-mist)", borderRadius: 999, height: 10, overflow: "hidden" }}>
            <div style={{ width: `${(n / max) * 100}%`, height: "100%", background: "var(--color-green)" }} />
          </div>
          <b>{n}</b>
        </div>
      ))}
    </div>
  );
}