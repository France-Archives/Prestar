import { useState, type FormEvent } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { InputField } from "@/components/forms/FormField";
import { describeError } from "@/utils/errors";
import { validateNewPassword, type FieldErrors } from "../authSchemas";
import PasswordStrength from "./PasswordStrength";

// Shared by Reset password (A7) and Accept invitation (P2).
export default function SetPasswordForm({ submitLabel, onSubmit }: { submitLabel: string; onSubmit: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateNewPassword(password, confirm);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await onSubmit(password);
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <InputField label="New password" type="password" autoComplete="new-password" value={password} error={errors.password} onChange={(e) => setPassword(e.target.value)} required />
      <PasswordStrength password={password} />
      <InputField label="Confirm password" type="password" autoComplete="new-password" value={confirm} error={errors.confirm} onChange={(e) => setConfirm(e.target.value)} required />
      {formError && <Alert kind="error">{formError}</Alert>}
      <Button type="submit" block loading={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}