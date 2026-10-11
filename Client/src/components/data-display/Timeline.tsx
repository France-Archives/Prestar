import type { ReactNode } from "react";

export interface TimelineItem {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  detail?: ReactNode;
}

export default function Timeline({ items, empty = "No history yet." }: { items: TimelineItem[]; empty?: string }) {
  if (items.length === 0) return <p className="subtle">{empty}</p>;
  return (
    <ol className="stack" style={{ listStyle: "none", padding: 0, gap: 10 }}>
      {items.map((i) => (
        <li
          key={i.id}
          style={{
            borderLeft: "4px solid var(--color-green)",
            background: "var(--color-cream)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 12px",
          }}
        >
          <div style={{ fontWeight: 600 }}>{i.title}</div>
          {i.meta && <div className="subtle">{i.meta}</div>}
          {i.detail && <div style={{ fontSize: "0.875rem" }}>{i.detail}</div>}
        </li>
      ))}
    </ol>
  );
}