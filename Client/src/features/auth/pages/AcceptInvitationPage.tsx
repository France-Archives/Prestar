import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { InputField } from "@/components/forms/FormField";
import { ROUTES } from "@/app/routeConfig";
import AuthLayout from "@/layouts/AuthLayout";
import { useToast } from "@/hooks/useToast";
import * as authService from "@/services/authService";
import { describeError } from "@/utils/errors";
import { validatePasswordPair, type FormErrors } from "../authSchemas";
import PasswordStrength from "../components/PasswordStrength";

// P2 POST /auth/accept-invitation (proposed, TC-19): a Librarian invited by an Admin sets a password here.
export default function AcceptInvitationPage() {
  const token = useSearchParams()[0].get("token");
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <AuthLayout title="Librarian invitation">
        <Alert kind="error">This invitation link is missing its token. Ask an Admin to send a new invitation.</Alert>
        <p style={{ textAlign: "center", marginTop: 14 }}>
          <Link to={ROUTES.login}>Back to sign in</Link>
        </p>
      </AuthLayout>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validatePasswordPair(password, confirm);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await authService.acceptInvitation({ token, password });
      toast.success("Account activated. Please sign in.");
      navigate(ROUTES.login, { replace: true });
    } catch (err) {
      setFormError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Accept your invitation" subtitle="Set a password to activate your Librarian account.">
      <form className="stack" onSubmit={submit} noValidate>
        <InputField label="Password" type="password" autoComplete="new-password" value={password} error={errors.password} onChange={(e) => setPassword(e.target.value)} />
        <PasswordStrength password={password} />
        <InputField label="Confirm password" type="password" autoComplete="new-password" value={confirm} error={errors.confirm} onChange={(e) => setConfirm(e.target.value)} />
        {formError && <Alert kind="error">{formError}</Alert>}
        <Button type="submit" block loading={busy}>
          Activate account
        </Button>
      </form>
    </AuthLayout>
  );
}