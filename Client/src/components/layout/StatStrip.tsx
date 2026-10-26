import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface StatItem {
  label: string;
  value: ReactNode;
  hint: string;
  icon: LucideIcon;
  tone?: "forest" | "green" | "amber" | "red" | "neutral";
  onClick?: () => void;
  selected?: boolean;
}

export default function StatStrip({ items, label = "Summary" }: { items: StatItem[]; label?: string }) {
  return (
    <section className="stat-strip" aria-label={label}>
      {items.map(({ label: title, value, hint, icon: Icon, tone = "forest", onClick, selected }) => {
        const className = [`stat-tile`, `stat-tile--${tone}`, onClick ? "stat-tile--interactive" : "", selected ? "is-selected" : ""].filter(Boolean).join(" ");
        const content = (
          <>
            <span className="stat-tile__icon"><Icon aria-hidden="true" /></span>
            <span className="stat-tile__content">
              <span className="stat-tile__label">{title}</span>
              <strong className="stat-tile__value">{value}</strong>
              <span className="stat-tile__hint">{hint}</span>
            </span>
          </>
        );
        return onClick
          ? <button type="button" className={className} key={title} aria-pressed={selected} aria-label={`${title}: ${hint}`} onClick={onClick}>{content}</button>
          : <article className={className} key={title}>{content}</article>;
      })}
    </section>
  );
}
