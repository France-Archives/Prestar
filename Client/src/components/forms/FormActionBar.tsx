import type { ReactNode } from "react";

export default function FormActionBar({ children }: { children: ReactNode }) {
  return <div className="form-action-bar">{children}</div>;
}
