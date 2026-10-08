import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import { useLibrary } from "../context/LibraryContext";
import * as api from "../services/api";
import type { LoginFormData, RegisterFormData, StudentType } from "../types";
import { EMAIL, NAME, isStrongPassword } from "../utils/validators";
import "./Auth.css";

type FormErrors = Record<string, string>;
type TextField = Exclude<keyof RegisterFormData, "noStudentId" | "consent">;

const INPUT_CLS =
  "h-11 w-full rounded-[10px] border border-prestar-forest/20 bg-white px-3.5 font-sans text-[14px] text-prestar-forest placeholder:text-prestar-forest/40 transition-[border-color,box-shadow] duration-200 hover:border-prestar-forest/35 focus:border-prestar-leaf focus:outline-none focus:ring-3 focus:ring-prestar-leaf/20 disabled:cursor-not-allowed disabled:bg-prestar-forest/5 disabled:opacity-60";

const BTN_BASE =
  "inline-flex h-12 items-center justify-center rounded-full bg-prestar-forest px-8 font-sans text-[12.5px] font-bold tracking-[0.14em] text-white shadow-[0_8px_18px_rgba(27,67,50,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-prestar-leaf hover:shadow-[0_12px_24px_rgba(27,67,50,0.26)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-prestar-leaf disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:bg-prestar-forest";

const PRIMARY_BTN = `${BTN_BASE} w-full`;
const CTA_BTN = `${BTN_BASE} w-full sm:w-auto sm:min-w-[210px]`;

const ERROR_BOX =
  "rounded-[10px] border border-prestar-error/30 bg-prestar-error/10 px-3.5 py-2.5 font-sans text-[12.5px] leading-snug text-prestar-error";

const CHECK_LABEL =
  "flex cursor-pointer items-start gap-2.5 font-sans text-[13px] leading-snug text-prestar-forest";

const EYEBROW =
  "block font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-prestar-leaf";

const HEADING =
  "mt-2 font-serif text-[30px] font-bold leading-tight text-prestar-forest sm:text-[36px]";

const BRAND_EYEBROW =
  "inline-flex items-center gap-3 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-prestar-leaf";

const BRAND_HEADING = "font-serif text-[32px] font-bold leading-tight text-prestar-forest sm:text-[38px]";

const BRAND_TEXT = "max-w-[32ch] font-sans text-[14.5px] leading-relaxed text-prestar-forest/70";

type FieldProps = { label: string; error?: string; children: ReactNode };
function Field({ label, error, children }: FieldProps) {
  return (
    <label
      className={`flex min-w-0 flex-1 flex-col gap-1.5 ${
        error ? "[&_input]:border-prestar-error [&_select]:border-prestar-error" : ""
      }`}
    >
      <span className="font-sans text-[12px] font-bold tracking-[0.02em] text-prestar-forest">{label}</span>
      {children}
      {error && (
        <em className="font-sans text-[12px] not-italic text-prestar-error" role="alert">
          {error}
        </em>
      )}
    </label>
  );
}

function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {off ? (
        <>
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

type PasswordProps = { value: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void; placeholder?: string; autoComplete?: string };
function Password({ value, onChange, placeholder, autoComplete }: PasswordProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className={`${INPUT_CLS} pr-11`}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label="Toggle password visibility"
        aria-pressed={show}
        className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-prestar-forest/60 transition-colors duration-200 hover:bg-prestar-forest/10 hover:text-prestar-forest focus-visible:outline-2 focus-visible:outline-prestar-leaf"
      >
        <EyeIcon off={show} />
      </button>
    </div>
  );
}

function SelectBox({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-prestar-forest/60"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

const STUDENT_TYPES: StudentType[] = ["Regular", "Transferee", "Returnee", "Other"];

const EMPTY_REG: RegisterFormData = {
  firstName: "", middleName: "", lastName: "", suffix: "", studentType: "Regular", studentId: "", noStudentId: false,
  previousSchool: "", course: "", yearLevel: "", email: "", password: "", confirm: "", consent: false,
};

export default function Auth() {
  const { login } = useLibrary();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The URL is the source of truth, so the browser back button flips the card too.
  const signup = pathname === "/signup";
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [form, setForm] = useState<LoginFormData>({ email: "", password: "" });
  const [reg, setReg] = useState<RegisterFormData>(EMPTY_REG);

  useEffect(() => {
    setErrors({});
  }, [pathname]);

  const switchTo = (to: "signup" | "login") => navigate(to === "signup" ? "/signup" : "/login");
  const set = (k: TextField) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setReg({ ...reg, [k]: e.target.value });

  const submitLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const er: FormErrors = {};
    if (!EMAIL.test(form.email.trim())) er.email = "Enter a valid school email.";
    if (!form.password) er.password = "Password is required.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setLoading(true);
    // MOCK AUTH — REPLACE WITH REAL BACKEND AUTHENTICATION LATER
    const res = await login(form.email, form.password);
    // On success the route guard redirects to the dashboard for the user's role.
    if (!res.ok) {
      setErrors({ form: res.error });
      setLoading(false);
    }
  };

  const validateReg = (): FormErrors => {
    const er: FormErrors = {};
    if (!NAME.test(reg.firstName.trim()) || reg.firstName.length > 100) er.firstName = "Required. Letters only.";
    if (!NAME.test(reg.lastName.trim()) || reg.lastName.length > 100) er.lastName = "Required. Letters only.";
    if (reg.middleName.trim() && !NAME.test(reg.middleName.trim())) er.middleName = "Letters only.";
    if (reg.suffix.trim() && !/^[A-Za-z.]{1,10}$/.test(reg.suffix.trim())) er.suffix = "e.g. Jr., III";
    if (!reg.noStudentId && !reg.studentId.trim()) er.studentId = "Required.";
    if (reg.studentType === "Transferee" && !reg.previousSchool.trim()) er.previousSchool = "Required for transferees.";
    if (reg.yearLevel && !(Number(reg.yearLevel) >= 1 && Number(reg.yearLevel) <= 10)) er.yearLevel = "1 to 10.";
    if (!EMAIL.test(reg.email.trim())) er.email = "Enter a valid school email.";
    if (!isStrongPassword(reg.password)) er.password = "8+ characters, a letter and a number.";
    if (reg.confirm !== reg.password) er.confirm = "Passwords do not match.";
    if (!reg.consent) er.consent = "You must agree to continue.";
    return er;
  };

  const submitReg = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const er = validateReg();
    setErrors(er);
    if (Object.keys(er).length) return;
    setLoading(true);
    // MOCK REGISTRATION — REPLACE WITH REAL BACKEND REGISTRATION LATER
    const res = await api.register(reg); // consent is validated here but not stored (Decision A)
    setLoading(false);
    if (!res.ok) {
      setErrors({ form: res.error });
      return;
    }
    navigate(`/verify-email?ref=${res.data.reference_no}`);
  };

  return (
    <main className="auth-shell flex min-h-dvh flex-col overflow-x-clip bg-(--auth-bg) font-sans text-prestar-forest">
      {/* Top bar: logo on the left, Back to Home on the right. Layout lives in Auth.css (.auth-top). */}
      <header className="auth-top">
        <Logo />
        <Link
          to="/"
          className="auth-home inline-flex items-center gap-2 rounded-full px-4 py-2 font-sans text-[13px] font-medium text-prestar-forest transition-colors duration-200 hover:bg-prestar-forest/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-prestar-leaf"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Home
        </Link>
      </header>

      <section className="flex flex-1 items-center justify-center px-4 pb-12 pt-2 sm:px-6">
        <div
          className={`auth-card grid w-full max-w-[560px] animate-[rise_0.5s_cubic-bezier(.22,.8,.3,1)_backwards] overflow-clip rounded-[20px] border border-prestar-forest/10 bg-(--auth-surface) lg:max-w-[1120px] lg:grid-cols-2 ${
            signup ? "is-signup" : ""
          }`}
        >
          {/* Form column: login and sign up forms are stacked; the inactive one collapses. */}
          <div className="auth-forms lg:col-start-1 lg:row-start-1">
            <div className="auth-pane auth-pane-login" aria-hidden={signup}>
              <div className="auth-pane-inner">
                <form
                  className="mx-auto flex w-full max-w-[480px] flex-col gap-5 px-6 py-10 sm:px-10 lg:py-16"
                  onSubmit={submitLogin}
                  noValidate
                  inert={signup}
                >
                  <div className="mb-1 text-center">
                    <span className={EYEBROW}>Welcome</span>
                    <h1 className={HEADING}>Sign in to PRESTAR</h1>
                  </div>
                  <Field label="School Email" error={errors.email}>
                    <input
                      className={INPUT_CLS}
                      type="email"
                      placeholder="you@university.edu"
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </Field>
                  <Field label="Password" error={errors.password}>
                    <Password
                      placeholder="Minimum 8 characters"
                      autoComplete="current-password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                  </Field>
                  {errors.form && !signup && (
                    <p className={ERROR_BOX} role="alert">
                      {errors.form}
                    </p>
                  )}
                  <button
                    type="button"
                    className="-mt-2 self-end font-sans text-[12.5px] font-medium text-prestar-teal underline-offset-4 transition-colors duration-200 hover:text-prestar-leaf hover:underline"
                    onClick={() => setErrors({ form: "Password reset is coming in a later phase." })}
                  >
                    Forgot your password?
                  </button>
                  <button type="submit" className={PRIMARY_BTN} disabled={loading}>
                    {loading ? "SIGNING IN…" : "SIGN IN"}
                  </button>
                </form>
              </div>
            </div>

            <div className="auth-pane auth-pane-signup" aria-hidden={!signup}>
              <div className="auth-pane-inner">
                <form
                  className="mx-auto flex w-full max-w-[540px] flex-col gap-4 px-6 py-10 sm:px-10 lg:py-12"
                  onSubmit={submitReg}
                  noValidate
                  inert={!signup}
                >
                  <div className="mb-2 text-center">
                    <span className={EYEBROW}>Join the library</span>
                    <h1 className={HEADING}>Create Account</h1>
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <Field label="First Name" error={errors.firstName}>
                      <input className={INPUT_CLS} value={reg.firstName} onChange={set("firstName")} placeholder="Alex" autoComplete="given-name" />
                    </Field>
                    <Field label="Last Name" error={errors.lastName}>
                      <input className={INPUT_CLS} value={reg.lastName} onChange={set("lastName")} placeholder="Morgan" autoComplete="family-name" />
                    </Field>
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <Field label="Middle Name (optional)" error={errors.middleName}>
                      <input className={INPUT_CLS} value={reg.middleName} onChange={set("middleName")} autoComplete="additional-name" />
                    </Field>
                    <Field label="Suffix (optional)" error={errors.suffix}>
                      <input className={INPUT_CLS} value={reg.suffix} onChange={set("suffix")} placeholder="Jr." />
                    </Field>
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <Field label="Student Type">
                      <SelectBox>
                        <select className={`${INPUT_CLS} appearance-none pr-9`} value={reg.studentType} onChange={set("studentType")}>
                          {STUDENT_TYPES.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </SelectBox>
                    </Field>
                    <Field label="Student ID" error={errors.studentId}>
                      <input
                        className={INPUT_CLS}
                        value={reg.studentId}
                        onChange={set("studentId")}
                        placeholder="2024-00123"
                        disabled={reg.noStudentId}
                      />
                    </Field>
                  </div>
                  <label className={CHECK_LABEL}>
                    <input
                      className="mt-0.5 h-4 w-4 shrink-0 accent-prestar-forest"
                      type="checkbox"
                      checked={reg.noStudentId}
                      onChange={(e) => setReg({ ...reg, noStudentId: e.target.checked, studentId: "" })}
                    />
                    <span>I do not have a Student ID yet</span>
                  </label>
                  {reg.studentType === "Transferee" && (
                    <Field label="Previous School" error={errors.previousSchool}>
                      <input className={INPUT_CLS} value={reg.previousSchool} onChange={set("previousSchool")} />
                    </Field>
                  )}
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <Field label="Course (optional)">
                      <input className={INPUT_CLS} value={reg.course} onChange={set("course")} />
                    </Field>
                    <Field label="Year Level (optional)" error={errors.yearLevel}>
                      <input className={INPUT_CLS} type="number" min="1" max="10" value={reg.yearLevel} onChange={set("yearLevel")} />
                    </Field>
                  </div>
                  <Field label="School Email" error={errors.email}>
                    <input
                      className={INPUT_CLS}
                      type="email"
                      placeholder="you@university.edu"
                      autoComplete="email"
                      value={reg.email}
                      onChange={set("email")}
                    />
                  </Field>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <Field label="Password" error={errors.password}>
                      <Password placeholder="Minimum 8 characters" autoComplete="new-password" value={reg.password} onChange={set("password")} />
                    </Field>
                    <Field label="Confirm" error={errors.confirm}>
                      <Password placeholder="Repeat password" autoComplete="new-password" value={reg.confirm} onChange={set("confirm")} />
                    </Field>
                  </div>
                  <label className={CHECK_LABEL}>
                    <input
                      className="mt-0.5 h-4 w-4 shrink-0 accent-prestar-forest"
                      type="checkbox"
                      checked={reg.consent}
                      onChange={(e) => setReg({ ...reg, consent: e.target.checked })}
                    />
                    <span>I agree to the Terms and Privacy Policy.</span>
                  </label>
                  {errors.consent && (
                    <p className={ERROR_BOX} role="alert">
                      {errors.consent}
                    </p>
                  )}
                  {errors.form && signup && (
                    <p className={ERROR_BOX} role="alert">
                      {errors.form}
                    </p>
                  )}
                  <button type="submit" className={`${PRIMARY_BTN} mt-1`} disabled={loading}>
                    {loading ? "CREATING…" : "CREATE ACCOUNT"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Editorial / switch panel: light, with soft decorative circles. Swaps sides on desktop. */}
          <aside className="auth-brand flex flex-col justify-center bg-(--auth-panel) px-8 py-12 text-center sm:px-14 lg:col-start-2 lg:row-start-1 lg:py-16">
            <div className="relative z-10 grid">
              <div className="auth-copy auth-copy-login flex flex-col items-center gap-4" inert={signup} aria-hidden={signup}>
                <span className={BRAND_EYEBROW}>
                  <span className="h-px w-8 bg-prestar-leaf/50" />
                  New here?
                  <span className="h-px w-8 bg-prestar-leaf/50" />
                </span>
                <h2 className={BRAND_HEADING}>Hello, Reader!</h2>
                <p className={BRAND_TEXT}>Enter your details and start your library journey with us.</p>
                <button type="button" className={`${CTA_BTN} mt-2`} onClick={() => switchTo("signup")}>
                  CREATE ACCOUNT
                </button>
              </div>

              <div className="auth-copy auth-copy-signup flex flex-col items-center gap-4" inert={!signup} aria-hidden={!signup}>
                <span className={BRAND_EYEBROW}>
                  <span className="h-px w-8 bg-prestar-leaf/50" />
                  Already a member?
                  <span className="h-px w-8 bg-prestar-leaf/50" />
                </span>
                <h2 className={BRAND_HEADING}>Welcome Back!</h2>
                <p className={BRAND_TEXT}>To keep connected, please sign in with your personal info.</p>
                <button type="button" className={`${CTA_BTN} mt-2`} onClick={() => switchTo("login")}>
                  SIGN IN
                </button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}