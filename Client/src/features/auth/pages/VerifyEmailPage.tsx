import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Spinner from "@/components/ui/Spinner";
import { ROUTES } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";
import AuthLayout from "@/layouts/AuthLayout";
import * as authService from "@/services/authService";
import { describeError } from "@/utils/errors";

type State = { kind: "working" } | { kind: "ok" } | { kind: "error"; message: string };

// A4: the token is single-use, so the call is guarded against React StrictMode running the effect twice.
export default function VerifyEmailPage() {
  const token = useSearchParams()[0].get("token");
  const { refresh } = useAuth();
  const [state, setState] = useState<State>(token ? { kind: "working" } : { kind: "error", message: "This link is missing its token." });
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    authService
      .verifyEmail({ token })
      .then(() => {
        setState({ kind: "ok" });
        void refresh();
      })
      .catch((e) => setState({ kind: "error", message: describeError(e) }));
  }, [token, refresh]);

  return (
    <AuthLayout title="Email verification">
      <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
        {state.kind === "working" && (
          <>
            <Spinner size={28} />
            <p>Verifying your email…</p>
          </>
        )}
        {state.kind === "ok" && (
          <>
            <Alert kind="ok">Your email has been verified.</Alert>
            <p>Next, submit an approved COR for the current term before borrowing.</p>
            <Link to={ROUTES.login} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }}>
              Log in
            </Link>
          </>
        )}
        {state.kind === "error" && (
          <>
            <Alert kind="error">{state.message}</Alert>
            <p className="subtle">Verification links are single-use and expire. Log in to request a new one.</p>
            <Link to={ROUTES.login} className="btn btn-ghost" style={{ textDecoration: "none" }}>
              Back to log in
            </Link>
          </>
        )}
      </div>
    </AuthLayout>
  );
}