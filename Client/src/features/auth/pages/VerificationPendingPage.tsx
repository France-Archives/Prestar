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
  mockToken?: string;
}

// The response to "resend" is always generic (no account enumeration).
export default function VerificationPendingPage() {
  const state = (useLocation().state ?? {}) as PendingState;
  const [token, setToken] = useState<string | undefined>(state.mockToken);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    if (!state.email) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authService.resendVerification({ email: state.email });
      if (res.mockToken) setToken(res.mockToken);
      setMessage("If that account still needs verification, a new link was sent.");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Check your email" subtitle={state.email ? `We sent a verification link to ${state.email}.` : "We sent you a verification link."}>
      <div className="stack">
        <p>Open the link to activate your account. After that, submit your Certificate of Registration (COR) for the current term before borrowing.</p>
        {USE_MOCKS && token && (
          <Alert kind="warn">
            <MockTag>Simulated</MockTag> No email was sent. For this demo, open the link yourself:{" "}
            <Link to={`${ROUTES.verifyEmail}?token=${encodeURIComponent(token)}`}>Open verification link (demo)</Link>
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