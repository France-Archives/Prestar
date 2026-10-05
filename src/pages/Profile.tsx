// Shared by all roles. Official fields are read-only because they come from the university registry.
import { useState, type ChangeEvent, type FormEvent } from "react";
import Badge from "../components/Badge";
import { useAuthedLibrary } from "../context/LibraryContext";
import { useBusy } from "../hooks/useBusy";
import * as api from "../services/api";
import type { PasswordFormData } from "../types";
import { fmtDate } from "../utils/dates";
import { isStrongPassword } from "../utils/validators";

type PasswordErrors = Partial<Record<keyof PasswordFormData, string>>;

const FIELDS: { key: keyof PasswordFormData; label: string }[] = [
  { key: "current", label: "Current password" },
  { key: "next", label: "New password" },
  { key: "confirm", label: "Confirm new password" },
];
const EMPTY: PasswordFormData = { current: "", next: "", confirm: "" };

export default function Profile() {
  const { db, user, act } = useAuthedLibrary();
  const [f, setF] = useState<PasswordFormData>(EMPTY);
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [busy, wrap] = useBusy();
  const student = user.role === "Student";

  const reg = user.student_id ? db.university_students.find((s) => s.student_id === user.student_id) : undefined;
  const signup = db.signups.find((s) => s.created_user_id === user.user_id);
  const reasons = student ? api.checkEligibility(user.user_id, "promote") : [];
  const set = (k: keyof PasswordFormData) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = wrap(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const er: PasswordErrors = {};
    if (!f.current) er.current = "Required.";
    if (!isStrongPassword(f.next)) er.next = "8+ characters, a letter and a number.";
    if (f.confirm !== f.next) er.confirm = "Passwords do not match.";
    setErrors(er);
    if (Object.keys(er).length) return;
    const res = await act(api.changePassword(user.user_id, f.current, f.next), "Password updated.");
    if (res.ok) setF(EMPTY);
    else setErrors({ current: res.error });
  });

  return (
    <>
      <span className="eyebrow">ACCOUNT</span>
      <h1 className="page-title">Profile</h1>
      <div className="grid-2">
        <div className="panel">
          <h2>{student ? "Student information" : "Staff information"}</h2>
          <dl className="kv">
            <div><dt>Name</dt><dd>{user.first_name} {user.last_name}</dd></div>
            <div><dt>School email</dt><dd>{user.email}</dd></div>
            {!student && <div><dt>Role</dt><dd>{user.role}</dd></div>}
            {student && user.student_id && (
              <>
                <div><dt>Student ID</dt><dd>{user.student_id}</dd></div>
                <div><dt>Course</dt><dd>{reg?.course ?? "—"}</dd></div>
                <div><dt>Year level</dt><dd>{reg?.year_level ?? "—"}</dd></div>
              </>
            )}
            {student && !user.student_id && (
              <>
                <div><dt>Reference no.</dt><dd>{signup?.reference_no ?? "—"}</dd></div>
                <div><dt>Course (submitted)</dt><dd>{signup?.submitted_course ?? "—"}</dd></div>
                <div><dt>Year level (submitted)</dt><dd>{signup?.submitted_year_level ?? "—"}</dd></div>
                <div><dt>Verification</dt><dd>Not yet verified by the registrar</dd></div>
                <div><dt>Temporary access until</dt><dd>{fmtDate(user.manual_verified_until)}</dd></div>
              </>
            )}
          </dl>
        </div>
        <div className="panel">
          <h2>Account</h2>
          <dl className="kv">
            <div><dt>Account status</dt><dd><Badge status={user.status} /></dd></div>
            {student && (
              <div>
                <dt>Borrowing status</dt>
                <dd>{reasons.length ? reasons.map((r) => <p key={r.code}>{r.message}</p>) : "In good standing"}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <form className="panel section pw-form" onSubmit={submit} noValidate>
        <h2>Change password</h2>
        {FIELDS.map(({ key, label }) => (
          <label className="field" key={key}>
            <span>{label}</span>
            <input type="password" value={f[key]} onChange={set(key)} />
            {errors[key] && <em>{errors[key]}</em>}
          </label>
        ))}
        <button className="btn primary sm" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
      </form>
    </>
  );
}