import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Alert, { MockTag } from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { ROUTES } from "@/app/routeConfig";
import AuthLayout from "@/layouts/AuthLayout";
import * as authService from "@/services/authService";
import { USE_MOCKS } from "@/utils/constants";
import { describeError } from "@/utils/errors";

interface PendingState {
  email?: string;
  mockCode?: string;
}

// The response to "resend" is always generic (no account enumeration).
export default function VerificationPendingPage() {
  const state = (useLocation().state ?? {}) as PendingState;
  const [code, setCode] = useState<string | undefined>(state.mockCode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    if (!state.email) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authService.resendVerification({ email: state.email });
      if (res.mockCode) setCode(res.mockCode);
      setMessage("If that account still needs verification, a new code was sent.");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Check your email" subtitle={state.email ? `We sent a verification code to ${state.email}.` : "We sent you a verification code."}>
      <div className="stack">
        <p>Enter the one-time code to activate your account. An approved COR for the current term is required only when borrowing, reserving, or renewing.</p>
        {USE_MOCKS && code && (
          <Alert kind="warn">
            <MockTag>Simulated</MockTag> No email was sent. Demo verification code: <strong>{code}</strong>{" "}
            <Link to={ROUTES.verifyEmail} state={{ email: state.email, mockCode: code }}>Enter code</Link>
          </Alert>
        )}
        {message && <Alert kind="ok">{message}</Alert>}
        {error && <Alert kind="error">{error}</Alert>}
        <div className="row-actions">
          {state.email && (
            <Button variant="ghost" onClick={resend} loading={busy}>
              Resend verification email
            </Button>
          )}
          <Link to={ROUTES.login} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }}>
            Go to log in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}