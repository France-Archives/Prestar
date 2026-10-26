import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { InputField } from "@/components/forms/FormField";
import { ROUTES } from "@/app/routeConfig";
import AuthLayout from "@/layouts/AuthLayout";
import * as authService from "@/services/authService";
import { USE_MOCKS } from "@/utils/constants";
import { describeError, toApiError } from "@/utils/errors";
import { validateEmail } from "@/utils/validators";
import SetPasswordForm from "../components/SetPasswordForm";
import {
  cooldownAfterResendFailure,
  formatCooldown,
  loginAfterResetNavigation,
  mapResetPasswordError,
  tickCooldown,
  validateResetPassword,
  type ResetPasswordErrors,
} from "../passwordResetFlow";

interface ResetRouteState {
  email?: unknown;
  cooldownSeconds?: unknown;
  message?: unknown;
}

function isRouteState(value: unknown): value is ResetRouteState {
  return typeof value === "object" && value !== null;
}

function numericCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const legacyMockToken = USE_MOCKS ? searchParams.get("token") : null;
  const routeState = isRouteState(location.state) ? location.state : {};
  const carriedEmail = typeof routeState.email === "string" ? routeState.email : null;
  const sentMessage = typeof routeState.message === "string" ? routeState.message : null;
  const initialCooldown = typeof routeState.cooldownSeconds === "number"
    ? Math.max(0, Math.floor(routeState.cooldownSeconds))
    : 0;
  const [email, setEmail] = useState(carriedEmail ?? "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [errors, setErrors] = useState<ResetPasswordErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [requestNewCode, setRequestNewCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown(tickCooldown), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown > 0]);

  useEffect(() => {
    if (!successMessage || legacyMockToken) return undefined;
    const timer = window.setTimeout(() => {
      navigate(ROUTES.login, {
        replace: true,
        state: loginAfterResetNavigation(),
      });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [successMessage, legacyMockToken, navigate]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateResetPassword({ email, otp, password, confirmPassword });
    setErrors(validationErrors);
    setFormError(null);
    setRequestNewCode(false);
    if (Object.keys(validationErrors).length > 0) return;

    setBusy(true);
    try {
      await authService.resetPassword({ email: email.trim(), otp, password, confirmPassword });
      setSuccessMessage("Password has been reset successfully. You may now log in.");
    } catch (error) {
      const mapped = mapResetPasswordError(error);
      setErrors(mapped.fieldErrors);
      setFormError(mapped.formError);
      setRequestNewCode(mapped.requestNewCode);
      if (mapped.requestNewCode && mapped.fieldErrors.otp) setOtp("");
      if (mapped.preserveCooldown) {
        setCooldown((current) => cooldownAfterResendFailure(current, toApiError(error).status));
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    const emailError = validateEmail(email);
    setErrors((current) => ({ ...current, email: emailError ?? undefined }));
    setFormError(null);
    setResendMessage(null);
    if (emailError) return;

    setResending(true);
    try {
      const response = await authService.forgotPassword({ email: email.trim() });
      setCooldown(response.cooldownSeconds ?? 120);
      setResendMessage(response.message ?? "If that email is registered, a reset code has been sent.");
      setRequestNewCode(false);
    } catch (error) {
      const apiError = toApiError(error);
      setFormError(describeError(apiError));
      if (apiError.status === 429) {
        setCooldown((current) => cooldownAfterResendFailure(current, apiError.status));
      }
    } finally {
      setResending(false);
    }
  };

  const legacyMockSubmit = async (newPassword: string) => {
    if (!legacyMockToken) return;
    await authService.resetPassword({ token: legacyMockToken, password: newPassword });
    setSuccessMessage("Your password was updated.");
  };

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={carriedEmail
        ? `Enter the code we sent to ${carriedEmail} and choose a new password.`
        : "Enter the code we sent to your school email and choose a new password."}
      className="auth-shell--reset"
      footer={<Link to={ROUTES.login}>Back to log in</Link>}
    >
      <div className="auth-reset-flow" aria-live="polite">
        {legacyMockToken ? (
          successMessage ? (
            <div className="auth-reset-flow__stack">
              <Alert kind="ok">{successMessage}</Alert>
              <Link to={ROUTES.login} className="btn btn-primary auth-reset-flow__submit">Back to log in</Link>
            </div>
          ) : (
            <SetPasswordForm submitLabel="Reset password" onSubmit={legacyMockSubmit} />
          )
        ) : successMessage ? (
          <div className="auth-reset-flow__stack">
            <Alert kind="ok">{successMessage}</Alert>
            <p className="subtle">Password updated, you can log in.</p>
          </div>
        ) : (
          <form className="auth-reset-flow__form" onSubmit={(event) => void submit(event)} noValidate>
            <InputField
              label="School email"
              type="email"
              autoComplete="email"
              autoFocus={!carriedEmail}
              readOnly={Boolean(carriedEmail)}
              aria-required="true"
              value={email}
              error={errors.email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {sentMessage && <Alert kind="info">{sentMessage}</Alert>}
            <InputField
              label="6-digit code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus={Boolean(carriedEmail)}
              aria-required="true"
              className="auth-reset-flow__code"
              value={otp}
              error={errors.otp}
              onChange={(event) => setOtp(numericCode(event.target.value))}
            />
            <InputField
              label="New password"
              type="password"
              autoComplete="new-password"
              aria-required="true"
              hint="Use at least 8 characters."
              value={password}
              error={errors.password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <InputField
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              aria-required="true"
              value={confirmPassword}
              error={errors.confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {formError && <Alert kind="error">{formError}</Alert>}
            {resendMessage && <Alert kind="info">{resendMessage}</Alert>}
            {requestNewCode && (
              <p className="auth-reset-flow__request-code">Request a new code to continue.</p>
            )}
            <Button type="submit" block loading={busy} disabled={busy} className="auth-reset-flow__submit">
              {busy ? "Resetting..." : "Reset password"}
            </Button>
            <div className="auth-reset-flow__resend">
              <button
                type="button"
                className="link-btn"
                onClick={() => void resend()}
                disabled={cooldown > 0 || resending}
              >
                {resending ? "Sending..." : cooldown > 0 ? `Resend in ${formatCooldown(cooldown)}` : "Resend code"}
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
