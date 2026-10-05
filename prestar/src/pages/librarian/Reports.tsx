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

export default function LibrarianReports() {
  const [key, setKey] = useState<ReportKey>("history");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const report = useLive(() => runReport(key, from, to));

  return (
    <>
      <span className="eyebrow">LIBRARIAN</span>
      <h1 className="page-title">Reports</h1>
      <div className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={key === k ? "active" : ""} onClick={() => setKey(k)}>{label}</button>
        ))}
      </div>
      <div className="toolbar">
        <label className="field inline"><span>From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field inline"><span>To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button className="btn ghost sm" onClick={() => { setFrom(""); setTo(""); }}>Clear dates</button>
      </div>
      <DataTable<ReportRow> columns={report.columns} rows={report.rows} empty="No data for this report and period." />
    </>
  );
}