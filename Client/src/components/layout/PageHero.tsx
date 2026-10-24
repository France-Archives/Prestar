import type { ReactNode } from "react";
import "./PageHero.css";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: string;
  leading?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
}

export default function PageHero({
  eyebrow = "Student",
  title,
  description,
  meta,
  leading,
  actions,
  children,
  compact = false,
}: PageHeroProps) {
  const descriptionParts = description?.split(/(\*\*[^*]+\*\*)/g);

  return (
    <header className={`page-hero${compact ? " page-hero--compact" : ""}`}>
      <div className="page-hero__copy">
        <div className="page-hero__meta">
          {leading}
          <span className="page-hero__eyebrow">{eyebrow}</span>
        </div>
        <h1 className="page-hero__title">{title}</h1>
        {descriptionParts && (
          <p className="page-hero__description">
            {descriptionParts.map((part, index) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={index}>{part.slice(2, -2)}</strong>
                : part
            )}
          </p>
        )}
        {children && <div className="page-hero__children">{children}</div>}
      </div>
      {(meta || actions) && (
        <div className="page-hero__actions">
          {meta && <span className="page-hero__chip">{meta}</span>}
          {actions}
        </div>
      )}
    </header>
  );
}
