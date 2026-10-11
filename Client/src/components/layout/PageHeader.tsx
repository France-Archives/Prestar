import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}

export default function PageHeader({ title, eyebrow, description, actions }: PageHeaderProps) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && (
          <p className="subtle" style={{ maxWidth: 680, marginTop: 4 }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="row-actions">{actions}</div>}
    </header>
  );
}