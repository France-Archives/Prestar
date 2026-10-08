import { useState } from "react";
import DataTable from "../../components/DataTable";
import { useLive } from "../../hooks/useLive";
import { runReport, type ReportKey, type ReportRow } from "../../services/reports";

// Librarian reports: borrowing, returns, overdue, popular books, categories and inventory.
// TEMPORARY MOCK: runReport computes in the browser. BACKEND REPLACEMENT: GET /librarian/reports/:key?from=&to=
const TABS: [ReportKey, string][] = [
  ["history", "Borrowing"],
  ["returned", "Returns"],
  ["overdue", "Overdue"],
  ["mostBorrowed", "Popular books"],
  ["category", "Categories"],
  ["inventory", "Inventory"],
  ["lostDamaged", "Lost / Damaged"],
];

const DESCRIPTIONS: Record<ReportKey, string> = {
  history: "Complete borrowing activity recorded by the library.",
  returned: "Books that have been returned to the library.",
  overdue: "Loans that are past their due date and still outstanding.",
  mostBorrowed: "Titles ranked by how often they have been borrowed.",
  category: "Library activity grouped by book category.",
  inventory: "Current holdings across the library collection.",
  lostDamaged: "Books reported as lost or damaged.",
} as Record<ReportKey, string>;

const CARD = "bg-[#FBFAF5] border border-[#D9DDD7] rounded-[14px] shadow-[0_1px_2px_rgba(11,61,50,0.05)]";
const LABEL = "text-xs uppercase tracking-[0.08em] text-[#6B756F] font-medium";
const STAT_VALUE = "font-['Playfair_Display',serif] text-2xl text-[#0B3D32] mt-1.5";

const formatDate = (value: string) => {
  if (!value) return "";
  const d = new Date(value + "T00:00:00");
  return isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export default function LibrarianReports() {
  const [key, setKey] = useState<ReportKey>("history");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const report = useLive(() => runReport(key, from, to));

  const activeLabel = TABS.find(([k]) => k === key)?.[1] ?? "";
  const hasPeriod = Boolean(from || to);
  const periodLabel = hasPeriod
    ? `${from ? formatDate(from) : "Earliest"} – ${to ? formatDate(to) : "Latest"}`
    : "All dates";
  const rowCount = report.rows.length;

  return (
    <>
      <span className="eyebrow">LIBRARIAN</span>
      <h1 className="page-title">Reports</h1>
      <p className="text-[#6B756F] mt-1 mb-5 max-w-[640px] leading-relaxed">
        Review library activity, inventory and circulation records by report type and period.
      </p>

      <div className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={key === k ? "active" : ""} onClick={() => setKey(k)}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 my-5">
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#0B3D32]`}>
          <div className={LABEL}>Selected report</div>
          <div className={STAT_VALUE}>{activeLabel}</div>
        </div>

        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#6F9B78]`}>
          <div className={LABEL}>Records shown</div>
          <div className={STAT_VALUE}>{rowCount}</div>
        </div>

        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#B98A4A]`}>
          <div className={LABEL}>Period</div>
          <div className={`${STAT_VALUE} !text-xl`}>{periodLabel}</div>
        </div>
      </div>

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
        <header className="flex flex-wrap justify-between items-baseline gap-2 px-5 py-4 border-b border-[#D9DDD7] bg-[#DCE5D7]">
          <div>
            <h2 className="font-['Playfair_Display',serif] text-xl text-[#07352C] m-0">
              {activeLabel} report
            </h2>
            <p className="mt-1 mb-0 text-sm text-[#6B756F]">{DESCRIPTIONS[key]}</p>
          </div>
          <span className="text-[13px] font-medium text-[#1F2A27]">
            {periodLabel} · {rowCount} {rowCount === 1 ? "record" : "records"}
          </span>
        </header>
        <div className="overflow-x-auto">
          <DataTable<ReportRow>
            columns={report.columns}
            rows={report.rows}
            empty="No data for this report and period."
          />
        </div>
      </section>
    </>
  );
}