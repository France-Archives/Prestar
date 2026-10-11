import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  note?: string;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  className?: string;
}

export default function Card({ title, note, actions, children, padded = true, className = "" }: CardProps) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {note && <p className="subtle">{note}</p>}
          </div>
          {actions && <div className="row-actions">{actions}</div>}
        </header>
      )}
      <div className={padded ? "card-pad" : ""}>{children}</div>
    </section>
  );
}