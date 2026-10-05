import { useState } from "react";
import DataTable from "../../components/DataTable";
import { useLive } from "../../hooks/useLive";
import { REPORTS, runReport, type ReportKey, type ReportRow } from "../../services/reports";

export default function Reports() {
  const [key, setKey] = useState<ReportKey>("current");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // MOCK API — REPLACE WITH REAL API CALL LATER (a backend report endpoint with date filters)
  const report = useLive(() => runReport(key, from, to));

  return (
    <>
      <span className="eyebrow">ADMIN</span>
      <h1 className="page-title">Reports</h1>
      <div className="tabs">
        {REPORTS.map(([k, label]) => (
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