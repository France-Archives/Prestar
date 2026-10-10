import type { ReactNode } from "react";

type Kind = "error" | "warn" | "info" | "ok";

export default function Alert({ kind = "info", children }: { kind?: Kind; children: ReactNode }) {
  return (
    <div className={`alert-box alert-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

/** Marks behaviour that is simulated in the frontend and must be replaced by the backend. */
export function MockTag({ children = "Simulated" }: { children?: ReactNode }) {
  return <span className="mock-tag">{children}</span>;
}