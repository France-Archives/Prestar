import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import Alert, { MockTag } from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { InputField } from "@/components/forms/FormField";
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
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!state.email || !code || code.length !== 6) return;
    setVerifying(true);
    setVerificationError(null);
    setMessage(null);
    setError(null);
    try {
      await authService.verifyEmail({ email: state.email, code });
      setVerified(true);
    } catch (e) {
      setVerificationError(describeError(e));
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (!state.email) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authService.resendVerification({ email: state.email });
      if (res.mockCode) setCode(res.mockCode);
      setMessage("If a pending registration exists, a verification email will be sent.");
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
            <MockTag>Simulated</MockTag> No email was sent. Demo verification code: <strong>{code}</strong>
          </Alert>
        )}
        {verified ? (
          <>
            <Alert kind="ok">Your email has been verified.</Alert>
            <p>You can now log in and browse the catalog. An approved COR for the current term is required before borrowing, reserving, or renewing.</p>
          </>
        ) : (
          <form className="stack" onSubmit={verify}>
            <InputField
              label="One-time code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code ?? ""}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setVerificationError(null);
              }}
            />
            {verificationError && <Alert kind="error">{verificationError}</Alert>}
            <Button type="submit" loading={verifying} disabled={busy || verifying || !state.email || code?.length !== 6}>
              Verify Email
            </Button>
          </form>
        )}
        {message && <Alert kind="ok">{message}</Alert>}
        {error && <Alert kind="error">{error}</Alert>}
        <div className="row-actions">
          {!verified && state.email && (
            <Button variant="ghost" onClick={resend} loading={busy} disabled={verifying}>
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