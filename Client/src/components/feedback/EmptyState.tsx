import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";

interface EmptyStateProps {
  title: string;
  text?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export default function EmptyState({ title, text, action, icon }: EmptyStateProps) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden="true">{icon ?? <BookOpen />}</span>
      <div className="empty__content">
        <h3>{title}</h3>
        {text && <p className="subtle">{text}</p>}
        {action}
      </div>
    </div>
  );
}