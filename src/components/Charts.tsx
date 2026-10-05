import type { ChartRow } from "../services/reports";

// Simple horizontal bars (no chart library).
type BarListProps = { rows: ChartRow[]; empty?: string };

export default function BarList({ rows, empty = "No data yet." }: BarListProps) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (!rows.length || !max) return <p className="muted">{empty}</p>;
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.label}>
          <span title={r.label}>{r.label}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} /></div>
          <b>{r.value}</b>
        </div>
      ))}
    </div>
  );
}