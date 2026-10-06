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

type FieldProps = { label: string; error?: string; children: ReactNode };
function Field({ label, error, children }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <em>{error}</em>}
    </label>
  );
}

type PasswordProps = { value: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void; placeholder?: string };
function Password({ value, onChange, placeholder }: PasswordProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw">
      <input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} />
      <button type="button" onClick={() => setShow(!show)} aria-label="Toggle password visibility">{show ? "🙈" : "👁"}</button>
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
    <main className="auth-page">
      <header className="auth-top">
        <Logo />
        <Link to="/" className="muted-link">Back to Home</Link>
      </header>
      <div className={`auth-card ${signup ? "signup" : ""}`}>
        <form className="auth-form left" onSubmit={submitLogin} noValidate inert={signup}>
          <h1>Sign in to PRESTAR</h1>
          <Field label="School Email" error={errors.email}>
            <input type="email" placeholder="you@university.edu" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Password" error={errors.password}>
            <Password placeholder="Minimum 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          {errors.form && !signup && <p className="form-error">{errors.form}</p>}
          <button type="button" className="link-right" onClick={() => setErrors({ form: "Password reset is coming in a later phase." })}>Forgot your password?</button>
          <button className="btn pill" disabled={loading}>{loading ? "SIGNING IN…" : "SIGN IN"}</button>
        </form>

        <form className="auth-form right" onSubmit={submitReg} noValidate inert={!signup}>
          <h1>Create Account</h1>
          <div className="row">
            <Field label="First Name" error={errors.firstName}><input value={reg.firstName} onChange={set("firstName")} placeholder="Alex" /></Field>
            <Field label="Last Name" error={errors.lastName}><input value={reg.lastName} onChange={set("lastName")} placeholder="Morgan" /></Field>
          </div>
          <div className="row">
            <Field label="Middle Name (optional)" error={errors.middleName}><input value={reg.middleName} onChange={set("middleName")} /></Field>
            <Field label="Suffix (optional)" error={errors.suffix}><input value={reg.suffix} onChange={set("suffix")} placeholder="Jr." /></Field>
          </div>
          <div className="row">
            <Field label="Student Type">
              <select value={reg.studentType} onChange={set("studentType")}>
                {STUDENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Student ID" error={errors.studentId}>
              <input value={reg.studentId} onChange={set("studentId")} placeholder="2024-00123" disabled={reg.noStudentId} />
            </Field>
          </div>
          <label className="check">
            <input type="checkbox" checked={reg.noStudentId} onChange={(e) => setReg({ ...reg, noStudentId: e.target.checked, studentId: "" })} />
            <span>I do not have a Student ID yet</span>
          </label>
          {reg.studentType === "Transferee" && (
            <Field label="Previous School" error={errors.previousSchool}><input value={reg.previousSchool} onChange={set("previousSchool")} /></Field>
          )}
          <div className="row">
            <Field label="Course (optional)"><input value={reg.course} onChange={set("course")} /></Field>
            <Field label="Year Level (optional)" error={errors.yearLevel}><input type="number" min="1" max="10" value={reg.yearLevel} onChange={set("yearLevel")} /></Field>
          </div>
          <Field label="School Email" error={errors.email}><input type="email" placeholder="you@university.edu" value={reg.email} onChange={set("email")} /></Field>
          <div className="row">
            <Field label="Password" error={errors.password}><Password placeholder="Minimum 8 characters" value={reg.password} onChange={set("password")} /></Field>
            <Field label="Confirm" error={errors.confirm}><Password placeholder="Repeat password" value={reg.confirm} onChange={set("confirm")} /></Field>
          </div>
          <label className="check">
            <input type="checkbox" checked={reg.consent} onChange={(e) => setReg({ ...reg, consent: e.target.checked })} />
            <span>I agree to the Terms and Privacy Policy.</span>
          </label>
          {errors.consent && <p className="form-error">{errors.consent}</p>}
          {errors.form && signup && <p className="form-error">{errors.form}</p>}
          <button className="btn pill" disabled={loading}>{loading ? "CREATING…" : "CREATE ACCOUNT"}</button>
        </form>

        <div className="auth-overlay">
          <div className="ov-inner ov-login">
            <h2>Hello, Reader!</h2>
            <p>Enter your details and start your library journey with us.</p>
            <button type="button" className="btn pill" onClick={() => switchTo("signup")}>CREATE ACCOUNT</button>
          </div>
          <div className="ov-inner ov-signup">
            <h2>Welcome Back!</h2>
            <p>To keep connected, please sign in with your personal info.</p>
            <button type="button" className="btn pill" onClick={() => switchTo("login")}>SIGN IN</button>
          </div>
        </div>
      </div>
    </main>
  );
}