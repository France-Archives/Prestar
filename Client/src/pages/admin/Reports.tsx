import { useState } from "react";
import DataTable, { type Column } from "../../components/DataTable";
import { useLive } from "../../hooks/useLive";
import { REPORTS, runReport, type ReportKey, type ReportRow } from "../../services/reports";

const CARD = "bg-[#FBFAF5] border border-[#D9DDD7] rounded-[14px] shadow-[0_1px_2px_rgba(11,61,50,0.05)]";
const LABEL = "text-xs uppercase tracking-[0.08em] text-[#6B756F] font-medium";
const PANEL_HEADER =
  "flex flex-wrap justify-between items-baseline gap-2 px-5 py-4 border-b border-[#D9DDD7] bg-[#DCE5D7]";
const PANEL_TITLE = "font-['Playfair_Display',serif] text-xl text-[#07352C] m-0";
const PANEL_NOTE = "mt-1 mb-0 text-sm text-[#6B756F]";

const formatDate = (value: string) => {
  if (!value) return "";
  const d = new Date(value + "T00:00:00");
  return isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export default function Reports() {
  const [key, setKey] = useState<ReportKey>("current");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // MOCK API — REPLACE WITH REAL API CALL LATER (a backend report endpoint with date filters)
  const report = useLive(() => runReport(key, from, to));

  const activeLabel = REPORTS.find(([k]) => k === key)?.[1] ?? "";
  const hasPeriod = Boolean(from || to);
  const periodLabel = hasPeriod
    ? `${from ? formatDate(from) : "Earliest"} – ${to ? formatDate(to) : "Latest"}`
    : "All dates";
  const rowCount = report.rows.length;
  const columns = report.columns as Column<ReportRow>[];

  const cell = (col: Column<ReportRow>, r: ReportRow) =>
    col.render ? col.render(r) : String((r as Record<string, unknown>)[col.key as string] ?? "—");

  return (
    <>
      <span className="eyebrow">ADMIN</span>
      <h1 className="page-title">Reports</h1>

      {/* System report banner */}
      <section className="rounded-[14px] bg-[#0B3D32] border border-[#07352C] shadow-[0_1px_2px_rgba(11,61,50,0.05)] px-6 py-5 mt-2 mb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.08em] text-[#D9C19A] font-medium">System report</div>
            <div className="font-['Playfair_Display',serif] text-[26px] text-[#F5F3EA] leading-tight mt-1">
              {activeLabel}
            </div>
            <p className="mt-1.5 mb-0 text-sm text-[#DCE5D7] max-w-[560px] leading-relaxed">
              System-wide records across students, librarians and the collection, for the selected period.
            </p>
          </div>
          <dl className="flex flex-wrap gap-6 m-0">
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-[#DCE5D7]/80 font-medium">Period</dt>
              <dd className="m-0 mt-1 font-['Playfair_Display',serif] text-lg text-[#F5F3EA]">{periodLabel}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-[#DCE5D7]/80 font-medium">Records</dt>
              <dd className="m-0 mt-1 font-['Playfair_Display',serif] text-lg text-[#F5F3EA]">{rowCount}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-[#DCE5D7]/80 font-medium">Report types</dt>
              <dd className="m-0 mt-1 font-['Playfair_Display',serif] text-lg text-[#F5F3EA]">{REPORTS.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Mobile and tablet: report selector as tabs */}
      <div className="lg:hidden mb-5 overflow-x-auto">
        <div className="tabs">
          {REPORTS.map(([k, label]) => (
            <button key={k} className={key === k ? "active" : ""} onClick={() => setKey(k)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)] gap-5 items-start">
        {/* Desktop: report directory */}
        <aside className={`${CARD} hidden lg:block overflow-hidden`}>
          <div className="px-4 py-3 border-b border-[#D9DDD7] bg-[#DCE5D7]">
            <div className="font-['Playfair_Display',serif] text-base text-[#07352C]">Report directory</div>
          </div>
          <nav className="p-2 grid gap-1" aria-label="Reports">
            {REPORTS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKey(k)}
                aria-current={key === k ? "page" : undefined}
                className={`w-full text-left px-3 py-2.5 rounded-[10px] text-sm cursor-pointer border-l-4 transition-colors ${
                  key === k
                    ? "bg-[#DCE5D7] border-l-[#0B3D32] text-[#0B3D32] font-semibold"
                    : "bg-transparent border-l-transparent text-[#1F2A27] hover:bg-[#F5F3EA]"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          {/* Period filter */}
          <div className={`toolbar ${CARD} px-[18px] py-3.5 mb-5 flex flex-wrap items-end gap-3`}>
            <label className="field inline">
              <span>From</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="field inline">
              <span>To</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button
              className="btn ghost sm"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              disabled={!hasPeriod}
            >
              Clear dates
            </button>
          </div>

          <section className={`${CARD} overflow-hidden`}>
            <header className={PANEL_HEADER}>
              <div>
                <h2 className={PANEL_TITLE}>{activeLabel}</h2>
                <p className={PANEL_NOTE}>Records for {periodLabel.toLowerCase() === "all dates" ? "all dates" : periodLabel}.</p>
              </div>
              <span className="text-[13px] font-medium text-[#1F2A27]">
                {rowCount} {rowCount === 1 ? "record" : "records"}
              </span>
            </header>

            {/* Desktop and tablet: report table */}
            <div className="hidden md:block overflow-x-auto">
              <DataTable<ReportRow> columns={columns} rows={report.rows} empty="No data for this report and period." />
            </div>

            {/* Mobile: record cards */}
            <div className="md:hidden p-3 grid gap-3">
              {rowCount === 0 && <p className="muted text-center py-6 m-0">No data for this report and period.</p>}
              {report.rows.map((r, i) => {
                const [first, second, ...rest] = columns;
                return (
                  <div
                    key={String(r.id ?? i)}
                    className="bg-[#FBFAF5] border border-[#D9DDD7] border-l-4 border-l-[#6F9B78] rounded-[12px] px-4 py-3.5"
                  >
                    {first && (
                      <div className="font-['Playfair_Display',serif] text-[17px] text-[#0B3D32] leading-snug break-words">
                        {cell(first, r)}
                      </div>
                    )}
                    {second && <div className="text-[13px] text-[#6B756F] break-words">{cell(second, r)}</div>}
                    {rest.length > 0 && (
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-3 mb-0">
                        {rest.map((c) => (
                          <div key={String(c.key)}>
                            <dt className={LABEL}>{c.label}</dt>
                            <dd className="m-0 mt-0.5 text-sm text-[#1F2A27] break-words">{cell(c, r)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}