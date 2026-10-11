import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { CheckboxField, InputField } from "@/components/forms/FormField";
import { ROUTES } from "@/app/routeConfig";
import * as authService from "@/services/authService";
import { describeError } from "@/utils/errors";
import { validateSignup, type FieldErrors, type SignupValues } from "../authSchemas";
import PasswordStrength from "./PasswordStrength";

const EMPTY: SignupValues = {
  firstName: "", middleName: "", lastName: "", suffix: "", studentNumber: "", program: "",
  yearLevel: "", email: "", password: "", confirm: "", consent: false,
};

// Public signup always creates a STUDENT. No role is ever sent (A1).
export default function SignupForm() {
  const navigate = useNavigate();
  const [v, setV] = useState<SignupValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const text = (k: Exclude<keyof SignupValues, "consent">) => ({
    value: v[k],
    error: errors[k],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }),
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateSignup(v);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const res = await authService.register({
        email: v.email.trim(),
        password: v.password,
        studentNumber: v.studentNumber.trim(),
        firstName: v.firstName.trim(),
        middleName: v.middleName.trim() || null,
        lastName: v.lastName.trim(),
        suffix: v.suffix.trim() || null,
        program: v.program.trim() || null,
        yearLevel: v.yearLevel.trim() ? Number(v.yearLevel) : null,
      });
      // mockVerificationToken is demo-only: a real backend emails the link and never returns the token.
      navigate(ROUTES.verificationPending, { state: { email: res.email, mockToken: res.mockVerificationToken } });
    } catch (err) {
      setFormError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="form-row">
        <InputField label="First name" required autoComplete="given-name" {...text("firstName")} />
        <InputField label="Last name" required autoComplete="family-name" {...text("lastName")} />
      </div>
      <div className="form-row">
        <InputField label="Middle name" {...text("middleName")} />
        <InputField label="Suffix" placeholder="Jr." {...text("suffix")} />
      </div>
      <div className="form-row">
        <InputField label="Student number" required placeholder="2026-00123" {...text("studentNumber")} />
        <InputField label="Year level" type="number" min={1} max={10} {...text("yearLevel")} />
      </div>
      <InputField label="Program" {...text("program")} />
      <InputField label="School email" type="email" required autoComplete="email" {...text("email")} />
      <InputField label="Password" type="password" required autoComplete="new-password" {...text("password")} />
      <PasswordStrength password={v.password} />
      <InputField label="Confirm password" type="password" required autoComplete="new-password" {...text("confirm")} />
      <CheckboxField
        label="I agree to the Terms and the Privacy Policy."
        checked={v.consent}
        error={errors.consent}
        onChange={(e) => setV({ ...v, consent: e.target.checked })}
      />
      {formError && <Alert kind="error">{formError}</Alert>}
      <Button type="submit" block loading={busy}>
        Create account
      </Button>
    </form>
  );
}