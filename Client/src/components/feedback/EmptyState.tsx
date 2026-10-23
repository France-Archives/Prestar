import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  text?: string;
  action?: ReactNode;
}

export default function EmptyState({ title, text, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {text && <p className="subtle">{text}</p>}
      {action}
    </div>
  );
}