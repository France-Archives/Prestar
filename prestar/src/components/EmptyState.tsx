import type { ReactNode } from "react";

type EmptyStateProps = { title: string; text?: string; action?: ReactNode };

export default function EmptyState({ title, text, action }: EmptyStateProps) {
  return (
    <div
      className="empty"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        textAlign: "center",
        padding: "32px 16px",
      }}
    >
      <h3 style={{ fontFamily: "var(--serif, Georgia, serif)", fontSize: 18 }}>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}