import type { ReactNode } from "react";

export default function PageToolbar({ children, label = "Page tools" }: { children: ReactNode; label?: string }) {
  return <div className="page-toolbar" role="toolbar" aria-label={label}>{children}</div>;
}
