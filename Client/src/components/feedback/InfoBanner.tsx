import type { ReactNode } from "react";
import Alert from "./Alert";

type Variant = "info" | "success" | "warning" | "danger";

export default function InfoBanner({ variant = "info", lead, children }: { variant?: Variant; lead: string; children: ReactNode }) {
  const kind = variant === "success" ? "ok" : variant === "warning" ? "warn" : variant === "danger" ? "error" : "info";
  return <Alert kind={kind}><strong>{lead}</strong> {children}</Alert>;
}
