import { Link } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="subtle" style={{ marginBottom: 8 }}>
      <ol style={{ display: "flex", flexWrap: "wrap", gap: 6, listStyle: "none", padding: 0 }}>
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} aria-current={i === items.length - 1 ? "page" : undefined}>
            {c.to && i < items.length - 1 ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
            {i < items.length - 1 && <span aria-hidden="true"> /</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}