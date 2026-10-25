import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

interface FieldShellProps {
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
}

interface RenderProps {
  id: string;
  invalid: boolean;
  describedBy?: string;
}

function Shell({ label, error, hint, required, render }: FieldShellProps & { render: (p: RenderProps) => ReactNode }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {render({ id, invalid: Boolean(error), describedBy })}
      {error ? (
        <span id={`${id}-err`} className="error" role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className="hint">
            {hint}
          </span>
        )
      )}
    </div>
  );
}

export function InputField({ label, error, hint, required, type, ...rest }: FieldShellProps & InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <Shell
      label={label}
      error={error}
      hint={hint}
      required={required}
      render={(p) =>
        isPassword ? (
          <div className="input-wrap">
            <input
              className="input"
              id={p.id}
              type={show ? "text" : "password"}
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
              required={required}
              {...rest}
            />
            <button
              type="button"
              className="input-wrap__toggle"
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
              onClick={() => setShow((s) => !s)}
            >
              {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        ) : (
          <input className="input" id={p.id} type={type} aria-invalid={p.invalid} aria-describedby={p.describedBy} required={required} {...rest} />
        )
      }
    />
  );
}

export function SelectField({
  label,
  error,
  hint,
  required,
  children,
  ...rest
}: FieldShellProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Shell
      label={label}
      error={error}
      hint={hint}
      required={required}
      render={(p) => (
        <select className="select" id={p.id} aria-invalid={p.invalid} aria-describedby={p.describedBy} required={required} {...rest}>
          {children}
        </select>
      )}
    />
  );
}

export function TextareaField({ label, error, hint, required, ...rest }: FieldShellProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Shell
      label={label}
      error={error}
      hint={hint}
      required={required}
      render={(p) => (
        <textarea className="textarea" id={p.id} aria-invalid={p.invalid} aria-describedby={p.describedBy} required={required} {...rest} />
      )}
    />
  );
}

export function CheckboxField({
  label,
  error,
  ...rest
}: { label: ReactNode; error?: string | null } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <div>
      <label className="check">
        <input type="checkbox" {...rest} />
        <span>{label}</span>
      </label>
      {error && (
        <span className="error" role="alert" style={{ fontSize: "0.75rem", color: "var(--color-brick)" }}>
          {error}
        </span>
      )}
    </div>
  );
}