import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { InputField } from "@/components/forms/FormField";
import { ROUTES } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";
import AuthLayout from "@/layouts/AuthLayout";
import * as authService from "@/services/authService";
import { describeError } from "@/utils/errors";

type VerifyState = { kind: "ready" } | { kind: "working" } | { kind: "ok" } | { kind: "error"; message: string };

export default function VerifyEmailPage() {
  const initial = (useLocation().state ?? {}) as { email?: string; mockCode?: string };
  const { refresh } = useAuth();
  const [email, setEmail] = useState(initial.email ?? "");
  const [code, setCode] = useState(initial.mockCode ?? "");
  const [state, setState] = useState<VerifyState>({ kind: "ready" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState({ kind: "working" });
    try {
      await authService.verifyEmail({ email: email.trim(), code: code.trim() });
      setState({ kind: "ok" });
      await refresh();
    } catch (error) {
      setState({ kind: "error", message: describeError(error) });
    }
  };

  return (
    <AuthLayout title="Email verification">
      <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
        {state.kind === "ok" && (
          <>
            <Alert kind="ok">Your email has been verified.</Alert>
            <p>You can now browse your dashboard and catalog. An approved COR for the current term is required before borrowing, reserving, or renewing.</p>
            <Link to={ROUTES.login} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }}>
              Log in
            </Link>
          </>
        )}
        {state.kind !== "ok" && (
          <form className="stack" onSubmit={submit}>
            {state.kind === "error" && <Alert kind="error">{state.message}</Alert>}
            <InputField label="School email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            <InputField label="One-time code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
            <Button type="submit" loading={state.kind === "working"} disabled={state.kind === "working" || code.length !== 6}>Verify email</Button>
            <p className="subtle">Codes are single-use and expire. <Link to={ROUTES.verificationPending} state={{ email }}>Request another code</Link>.</p>
            <Link to={ROUTES.login} className="btn btn-ghost" style={{ textDecoration: "none" }}>Back to log in</Link>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}