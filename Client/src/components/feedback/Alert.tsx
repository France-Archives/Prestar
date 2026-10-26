import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, CircleX, Info } from "lucide-react";

type Kind = "error" | "warn" | "info" | "ok";

export default function Alert({ kind = "info", children }: { kind?: Kind; children: ReactNode }) {
  const Icon = kind === "error" ? CircleX : kind === "warn" ? CircleAlert : kind === "ok" ? CircleCheck : Info;
  return (
    <div className={`alert-box alert-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <Icon className="alert-box__icon" aria-hidden="true" />
      <div className="alert-box__content">{children}</div>
    </div>
  );
}

/** Marks behaviour that is simulated in the frontend and must be replaced by the backend. */
export function MockTag({ children = "Simulated" }: { children?: ReactNode }) {
  return <span className="mock-tag">{children}</span>;
}