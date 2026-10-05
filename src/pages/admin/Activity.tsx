// System Activity: derived from the existing who/when columns. There is no audit_logs table.
import { useState } from "react";
import DataTable, { type Column } from "../../components/DataTable";
import { useLive } from "../../hooks/useLive";
import { activityFeed, type ActivityEvent, type ActivityKind } from "../../services/reports";

const KINDS: ActivityKind[] = ["Lending", "Returns", "Requests", "Penalties", "Suspensions", "Signups"];
const COLUMNS: Column<ActivityEvent>[] = [
  { key: "when", label: "When" },
  { key: "who", label: "Who" },
  { key: "kind", label: "Type" },
  { key: "text", label: "What happened" },
];

export default function Activity() {
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");

  const feed = useLive(activityFeed);
  const term = q.trim().toLowerCase();
  const rows = feed.filter((e) => (kind === "all" || e.kind === kind) && (!term || `${e.who} ${e.text}`.toLowerCase().includes(term)));

  return (
    <>
      <span className="eyebrow">ADMIN</span>
      <h1 className="page-title">System Activity</h1>
      <div className="toolbar">
        <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by person or action…" />
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">All types</option>
          {KINDS.map((k) => <option key={k}>{k}</option>)}
        </select>
      </div>
      <DataTable columns={COLUMNS} rows={rows} pageSize={15} empty="No activity yet." />
    </>
  );
}