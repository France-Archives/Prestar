import { useState, type FormEvent } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import { CheckboxField, InputField } from "@/components/forms/FormField";
import { LIBRARIAN_PERMISSIONS, type CreateStaffAccountRequest, type LibrarianPermission } from "@/types";
import { USE_MOCKS } from "@/utils/constants";
import { describeError } from "@/utils/errors";
import { passwordChecks, validateEmail, validateName, validatePassword, validatePasswordMatch } from "@/utils/validators";

export const PERMISSION_LABELS: Record<LibrarianPermission, string> = {
  COR_REVIEW: "Review CORs",
  CATALOG_MANAGE: "Manage the catalog (books, copies, categories, authors)",
  FINE_PAYMENT: "Assess fines and record payments",
};

export interface StaffAccountFormValues {
  firstName: string;
  lastName: string;
  email: string;
  employeeNumber: string;
  password: string;
  confirmPassword: string;
}

export type StaffAccountFormErrors = Partial<Record<keyof StaffAccountFormValues, string>>;

export function validateStaffAccountForm(values: StaffAccountFormValues): StaffAccountFormErrors {
  const errors: StaffAccountFormErrors = {};
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  else if (values.email.trim().length > 255) errors.email = "A valid email address (max 255 characters) is required.";
  const firstNameError = validateName(values.firstName, "First name");
  if (firstNameError) errors.firstName = firstNameError;
  const lastNameError = validateName(values.lastName, "Last name");
  if (lastNameError) errors.lastName = lastNameError;
  if (values.employeeNumber.trim().length > 50) errors.employeeNumber = "Employee number must not exceed 50 characters.";
  const passwordError = validatePassword(values.password);
  if (passwordError) errors.password = passwordError;
  else if (validatePasswordMatch(values.password, values.confirmPassword)) errors.confirmPassword = "Passwords do not match.";
  return errors;
}

export function serverErrorField(message: string): keyof StaffAccountFormValues | null {
  const text = message.toLowerCase();
  if (text.includes("email")) return "email";
  if (text.includes("password")) return "password";
  if (text.includes("first name")) return "firstName";
  if (text.includes("last name")) return "lastName";
  if (text.includes("employee number")) return "employeeNumber";
  return null;
}

export interface StaffAccountSubmissionResult {
  fieldErrors: StaffAccountFormErrors;
  formError: string | null;
  success: boolean;
}

export async function submitStaffAccountForm(
  role: "Librarian" | "Admin",
  values: StaffAccountFormValues,
  permissions: LibrarianPermission[],
  onCreate: (request: CreateStaffAccountRequest) => Promise<unknown>,
): Promise<StaffAccountSubmissionResult> {
  const fieldErrors = validateStaffAccountForm(values);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, formError: null, success: false };
  try {
    await onCreate({
      email: values.email.trim(),
      password: values.password,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      employeeNumber: values.employeeNumber.trim() || null,
      ...(role === "Librarian" && USE_MOCKS ? { permissions } : {}),
    });
    return { fieldErrors: {}, formError: null, success: true };
  } catch (error) {
    const message = describeError(error);
    const field = serverErrorField(message);
    return {
      fieldErrors: field ? { [field]: message } : {},
      formError: field ? null : message,
      success: false,
    };
  }
}

export interface StaffAccountFormProps {
  role: "Librarian" | "Admin";
  onCreate: (request: CreateStaffAccountRequest) => Promise<unknown>;
  onDone?: () => void;
  onCancel?: () => void;
  requireConfirmation?: boolean;
}

const EMPTY_VALUES: StaffAccountFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  employeeNumber: "",
  password: "",
  confirmPassword: "",
};

export default function StaffAccountForm({
  role,
  onCreate,
  onDone,
  onCancel,
  requireConfirmation = false,
}: StaffAccountFormProps) {
  const [values, setValues] = useState(EMPTY_VALUES);
  const [permissions, setPermissions] = useState<LibrarianPermission[]>([]);
  const [errors, setErrors] = useState<StaffAccountFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const change = (field: keyof StaffAccountFormValues) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
  };

  const togglePermission = (permission: LibrarianPermission) => {
    setPermissions((current) => current.includes(permission)
      ? current.filter((value) => value !== permission)
      : [...current, permission]);
  };

  const create = async () => {
    setBusy(true);
    try {
      const result = await submitStaffAccountForm(role, values, permissions, onCreate);
      setErrors(result.fieldErrors);
      setFormError(result.formError);
      if (!result.success) {
        const firstFieldError = Object.values(result.fieldErrors)[0];
        if (requireConfirmation) throw new Error(result.formError ?? firstFieldError ?? "The account could not be created.");
        return;
      }
      setValues(EMPTY_VALUES);
      setPermissions([]);
      setErrors({});
      setSuccess(`${role} account created successfully.`);
      onDone?.();
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateStaffAccountForm(values);
    setErrors(validationErrors);
    setFormError(null);
    if (Object.keys(validationErrors).length > 0) return;
    if (requireConfirmation) setConfirming(true);
    else void create();
  };

  return (
    <>
      <form className="stack" onSubmit={submit} noValidate>
        {success && <Alert kind="ok">{success}</Alert>}
        <div className="form-row">
          <InputField label="First name" required autoComplete="given-name" value={values.firstName} error={errors.firstName} onChange={change("firstName")} />
          <InputField label="Last name" required autoComplete="family-name" value={values.lastName} error={errors.lastName} onChange={change("lastName")} />
        </div>
        <div className="form-row">
          <InputField label="Email" type="email" required autoComplete="email" value={values.email} error={errors.email} onChange={change("email")} />
          <InputField label="Employee number" value={values.employeeNumber} error={errors.employeeNumber} onChange={change("employeeNumber")} />
        </div>
        <div className="form-row">
          <InputField label="Password" type="password" required autoComplete="new-password" value={values.password} error={errors.password} onChange={change("password")} />
          <InputField label="Confirm password" type="password" required autoComplete="new-password" value={values.confirmPassword} error={errors.confirmPassword} onChange={change("confirmPassword")} />
        </div>
        <ul className="stack" aria-label="Password requirements" style={{ listStyle: "none", padding: 0, gap: 4 }}>
          {passwordChecks(values.password).map((rule) => (
            <li key={rule.label} className={rule.ok ? "subtle" : "hint"}>{rule.ok ? "✓" : "○"} {rule.label}</li>
          ))}
          <li className={new TextEncoder().encode(values.password).length <= 72 ? "subtle" : "hint"}>
            {new TextEncoder().encode(values.password).length <= 72 ? "✓" : "○"} Maximum 72 bytes
          </li>
        </ul>
        {role === "Librarian" && (
          USE_MOCKS ? (
            <fieldset className="stack" style={{ gap: 6 }}>
              <legend style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-forest)" }}>Extra permissions</legend>
              {LIBRARIAN_PERMISSIONS.map((permission) => (
                <CheckboxField key={permission} label={PERMISSION_LABELS[permission]} checked={permissions.includes(permission)} onChange={() => togglePermission(permission)} />
              ))}
            </fieldset>
          ) : (
            <p className="subtle">Permissions are not available yet.</p>
          )
        )}
        {formError && <Alert kind="error">{formError}</Alert>}
        <div className="row-actions">
          {onCancel && <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>}
          <Button type="submit" loading={busy} disabled={busy}>{`Create ${role}`}</Button>
        </div>
      </form>
      {confirming && (
        <ConfirmDialog
          title={`Create ${role} account?`}
          message={role === "Admin" ? "This account will have full admin access." : `This will create a Librarian account for ${values.firstName.trim()} ${values.lastName.trim()}.`}
          details={[
            { label: "Name", value: `${values.firstName.trim()} ${values.lastName.trim()}` },
            { label: "Email", value: values.email.trim() },
          ]}
          confirmLabel={`Create ${role}`}
          onConfirm={create}
          onClose={() => setConfirming(false)}
        >
        </ConfirmDialog>
      )}
    </>
  );
}
