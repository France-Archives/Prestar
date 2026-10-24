import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Alert, { MockTag } from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { InputField } from "@/components/forms/FormField";
import { ROUTES } from "@/app/routeConfig";
import AuthLayout from "@/layouts/AuthLayout";
import * as authService from "@/services/authService";
import { USE_MOCKS } from "@/utils/constants";
import { describeError } from "@/utils/errors";
import { resetStepNavigation, validateForgotPassword } from "../passwordResetFlow";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [mockToken, setMockToken] = useState<string | undefined>();
  const [mockSent, setMockSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = validateForgotPassword(email);
    setFieldError(problem);
    setError(null);
    if (problem) return;

    setBusy(true);
    try {
      const response = await authService.forgotPassword({ email: email.trim() });
      if (USE_MOCKS) {
        setMockToken(response.mockToken);
        setMockSent(true);
        return;
      }
      navigate(ROUTES.resetPassword, {
        state: resetStepNavigation(
          email,
          response.cooldownSeconds ?? 120,
          response.message ?? "If that email is registered, a reset code has been sent.",
        ),
      });
    } catch (requestError) {
      setError(describeError(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your school email and we will send you a 6-digit code."
      className="auth-shell--reset"
      footer={<Link to={ROUTES.login}>Back to log in</Link>}
    >
      <div className="auth-reset-flow" aria-live="polite">
        {mockSent ? (
          <div className="auth-reset-flow__stack">
            <Alert kind="ok">If that email is registered, a reset code has been sent.</Alert>
            {mockToken && (
              <Alert kind="warn">
                <MockTag>Simulated</MockTag>{" "}
                <Link to={`${ROUTES.resetPassword}?token=${encodeURIComponent(mockToken)}`}>Open password reset (demo)</Link>
              </Alert>
            )}
            {!mockToken && <p className="subtle">No demo reset code is available for that address.</p>}
            <Link to={ROUTES.login} className="link-btn">Back to log in</Link>
          </div>
        ) : (
          <form className="auth-reset-flow__form" onSubmit={(event) => void submit(event)} noValidate>
            <InputField
              label="School email"
              type="email"
              autoComplete="email"
              autoFocus
              aria-required="true"
              value={email}
              error={fieldError}
              onChange={(event) => setEmail(event.target.value)}
            />
            {error && <Alert kind="error">{error}</Alert>}
            <Button type="submit" block loading={busy} disabled={busy} className="auth-reset-flow__submit">
              {busy ? "Sending..." : "Send reset code"}
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
