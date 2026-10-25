import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface StatItem {
  label: string;
  value: ReactNode;
  hint: string;
  icon: LucideIcon;
  tone?: "forest" | "green" | "amber" | "red" | "neutral";
}

export default function StatStrip({ items, label = "Summary" }: { items: StatItem[]; label?: string }) {
  return (
    <section className="stat-strip" aria-label={label}>
      {items.map(({ label: title, value, hint, icon: Icon, tone = "forest" }) => (
        <article className={`stat-tile stat-tile--${tone}`} key={title}>
          <span className="stat-tile__icon"><Icon aria-hidden="true" /></span>
          <div className="stat-tile__content">
            <span className="stat-tile__label">{title}</span>
            <strong className="stat-tile__value">{value}</strong>
            <span className="stat-tile__hint">{hint}</span>
          </div>
        </article>
      ))}
    </section>
  );
}
