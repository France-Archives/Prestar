import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Alert, { MockTag } from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { InputField } from "@/components/forms/FormField";
import { ROUTES } from "@/app/routeConfig";
import AuthLayout from "@/layouts/AuthLayout";
import * as authService from "@/services/authService";
import { USE_MOCKS } from "@/utils/constants";
import { describeError } from "@/utils/errors";
import { validateEmail } from "@/utils/validators";

// A6: the response is always generic, so the page never reveals whether an account exists.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateEmail(email);
    setFieldError(problem);
    setError(null);
    if (problem) return;
    setBusy(true);
    try {
      const res = await authService.forgotPassword({ email: email.trim() });
      setToken(res.mockToken);
      setSent(true);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" footer={<Link to={ROUTES.login}>Back to log in</Link>}>
      {sent ? (
        <div className="stack">
          <Alert kind="ok">If an account exists for that email, a reset link was sent. It expires soon and works once.</Alert>
          {USE_MOCKS && token && (
            <Alert kind="warn">
              <MockTag>Simulated</MockTag> No email was sent. <Link to={`${ROUTES.resetPassword}?token=${encodeURIComponent(token)}`}>Open reset link (demo)</Link>
            </Alert>
          )}
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <InputField label="School email" type="email" autoComplete="email" value={email} error={fieldError} onChange={(e) => setEmail(e.target.value)} required />
          {error && <Alert kind="error">{error}</Alert>}
          <Button type="submit" block loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}