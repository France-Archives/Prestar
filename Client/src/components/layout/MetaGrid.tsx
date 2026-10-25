import type { CSSProperties, ReactNode } from "react";

export interface MetaItem {
  label: string;
  value: ReactNode;
}

export function LabeledField({ label, value }: MetaItem) {
  return (
    <div className="meta-field">
      <dt className="meta-field__label">{label}</dt>
      <dd className="meta-field__value">{value}</dd>
    </div>
  );
}

export default function MetaGrid({ items, columns = 2, label }: { items: MetaItem[]; columns?: 2 | 3 | 4; label?: string }) {
  return (
    <dl className="meta-grid" aria-label={label} style={{ "--meta-columns": columns } as CSSProperties}>
      {items.map((item) => <LabeledField key={item.label} {...item} />)}
    </dl>
  );
}
