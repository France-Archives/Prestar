import type { ReactNode } from "react";

export default function FormSection({ title, helper, children }: { title: string; helper?: string; children: ReactNode }) {
  return (
    <fieldset className="form-section">
      <legend className="form-section__title">{title}</legend>
      {helper && <p className="form-section__helper">{helper}</p>}
      <div className="form-section__fields">{children}</div>
    </fieldset>
  );
}
