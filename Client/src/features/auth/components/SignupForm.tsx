import { useState, type ChangeEvent, type FormEvent, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import Modal from "@/components/ui/Modal";
import { CheckboxField, InputField, SelectField } from "@/components/forms/FormField";
import { ROUTES } from "@/app/routeConfig";
import { MOCK_COLLEGES } from "@/data";
import * as authService from "@/services/authService";
import { describeError } from "@/utils/errors";
import { validateSignup, type FieldErrors, type SignupValues } from "../authSchemas";
import PasswordStrength from "./PasswordStrength";
import { PrivacyContent, TermsContent } from "./LegalContent";

const EMPTY: SignupValues = {
  firstName: "", middleName: "", lastName: "", suffix: "", studentNumber: "", college: "", program: "",
  yearLevel: "", email: "", password: "", confirm: "", consent: false,
};

type LegalDoc = "terms" | "privacy" | null;

// Public signup always creates a STUDENT. No role is ever sent (A1).
export default function SignupForm() {
  const navigate = useNavigate();
  const [v, setV] = useState<SignupValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<LegalDoc>(null);

  // TEMPORARY: colleges come from mock data until the backend provides them.
  const courses = MOCK_COLLEGES.find((c) => c.name === v.college)?.courses ?? [];

  const text = (k: Exclude<keyof SignupValues, "consent">) => ({
    value: v[k],
    error: errors[k],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }),
  });

  const openLegal = (doc: Exclude<LegalDoc, null>) => (e: MouseEvent) => {
    // The links sit inside the checkbox label, so stop the click from toggling the checkbox.
    e.preventDefault();
    e.stopPropagation();
    setLegal(doc);
  };

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
        college: v.college,
        program: v.program, // the selected course
        yearLevel: Number(v.yearLevel),
      });
      // mockVerificationToken is demo-only: a real backend emails the link and never returns the token.
      navigate(ROUTES.verificationPending, { state: { email: res.email, mockToken: res.mockVerificationToken } });
    } catch (err) {
      setFormError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <>
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
          <InputField label="Year level" required type="number" min={1} max={10} {...text("yearLevel")} />
        </div>
        <div className="form-row">
          <SelectField
            label="College"
            required
            value={v.college}
            error={errors.college}
            onChange={(e) => setV({ ...v, college: e.target.value, program: "" })}
          >
            <option value="">Select your college</option>
            {MOCK_COLLEGES.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Course"
            required
            value={v.program}
            error={errors.program}
            disabled={!v.college}
            onChange={(e) => setV({ ...v, program: e.target.value })}
          >
            <option value="">{v.college ? "Select your course" : "Select a college first"}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </SelectField>
        </div>
        <InputField label="School email" type="email" required autoComplete="email" {...text("email")} />
        <div className="form-row">
          <InputField label="Password" type="password" required autoComplete="new-password" {...text("password")} />
          <InputField label="Confirm password" type="password" required autoComplete="new-password" {...text("confirm")} />
        </div>
        <PasswordStrength password={v.password} />
        <CheckboxField
          label={
            <>
              I agree to the{" "}
              <button type="button" className="link-btn" onClick={openLegal("terms")}>
                Terms
              </button>{" "}
              and the{" "}
              <button type="button" className="link-btn" onClick={openLegal("privacy")}>
                Privacy Policy
              </button>
              .
            </>
          }
          checked={v.consent}
          error={errors.consent}
          onChange={(e) => setV({ ...v, consent: e.target.checked })}
        />
        {formError && <Alert kind="error">{formError}</Alert>}
        <Button type="submit" block loading={busy}>
          Create account
        </Button>
      </form>

      {legal && (
        <Modal
          title={legal === "terms" ? "Terms of use" : "Privacy Policy"}
          onClose={() => setLegal(null)}
          wide
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setLegal(null)}>
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setV({ ...v, consent: true });
                  setErrors({ ...errors, consent: "" });
                  setLegal(null);
                }}
              >
                I agree
              </Button>
            </>
          }
        >
          {legal === "terms" ? <TermsContent /> : <PrivacyContent />}
        </Modal>
      )}
    </>
  );
}