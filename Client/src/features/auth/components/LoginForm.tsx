import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { InputField } from "@/components/forms/FormField";
import { ROUTES } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";
import { describeError } from "@/utils/errors";
import { validateLogin, type FieldErrors } from "../authSchemas";
import AuthPanel from "./AuthPanel";

// On success AuthContext holds the user and the GuestOnly route guard redirects to ?next= or the role's home.
export default function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateLogin({ email, password });
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      setFormError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <>
      <form className="stack" onSubmit={submit} noValidate>
        <InputField label="School email" type="email" autoComplete="email" value={email} error={errors.email} onChange={(e) => setEmail(e.target.value)} required />
        <InputField label="Password" type="password" autoComplete="current-password" value={password} error={errors.password} onChange={(e) => setPassword(e.target.value)} required />
        {formError && <Alert kind="error">{formError}</Alert>}
        <Button type="submit" block loading={busy}>
          Log in
        </Button>
        <p style={{ textAlign: "center" }}>
          <Link to={ROUTES.forgotPassword} className="link-btn">
            Forgot your password?
          </Link>
        </p>
      </form>
      <AuthPanel
        onPick={(e, p) => {
          setEmail(e);
          setPassword(p);
          setErrors({});
        }}
      />
    </>
  );
}