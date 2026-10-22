import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Barcode, CheckCircle2, Info, LockKeyhole } from "lucide-react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import { InputField, SelectField } from "@/components/forms/FormField";
import LoadingState from "@/components/feedback/LoadingState";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { MOCK_COLLEGES } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import * as authService from "@/services/authService";
import { USE_MOCKS } from "@/utils/constants";
import { describeError } from "@/utils/errors";
import { validateName, validateYearLevel } from "@/utils/validators";
import "@/styles/profile.css";

// Email and student number are not editable here (email-change policy is TO CONFIRM, TC-03).
export default function StudentProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const profile = useAsync(() => authService.getMyProfile(), []);
  const [v, setV] = useState({ firstName: "", middleName: "", lastName: "", suffix: "", college: "", program: "", yearLevel: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = profile.data;
    if (p) {
      // Older records have a course but no college, so find the college that owns the course.
      const college =
        p.college ?? MOCK_COLLEGES.find((c) => c.courses.some((x) => x.name === p.program))?.name ?? "";
      setV({
        firstName: p.firstName,
        middleName: p.middleName ?? "",
        lastName: p.lastName,
        suffix: p.suffix ?? "",
        college,
        program: p.program ?? "",
        yearLevel: p.yearLevel ? String(p.yearLevel) : "",
      });
    }
  }, [profile.data]);

  if (profile.loading) return <div className="page"><LoadingState rows={4} /></div>;
  if (profile.error || !profile.data) return <div className="page"><ErrorState message={profile.error ?? "Could not load your profile."} onRetry={() => void profile.reload()} /></div>;
  const p = profile.data;

  const courses = MOCK_COLLEGES.find((c) => c.name === v.college)?.courses ?? [];
  const fullName = [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(" ");
  const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();

  const text = (key: keyof typeof v) => ({ value: v[key], error: errors[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [key]: e.target.value }) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    const checks: [string, string | null][] = [
      ["firstName", validateName(v.firstName, "First name")],
      ["lastName", validateName(v.lastName, "Last name")],
      ["college", v.college ? null : "Select your college."],
      ["program", v.program ? null : "Select your course."],
      ["yearLevel", v.yearLevel.trim() ? validateYearLevel(v.yearLevel) : "Year level is required."],
    ];
    checks.forEach(([k, m]) => m && (found[k] = m));
    if (v.middleName.trim()) {
      const m = validateName(v.middleName, "Middle name", false);
      if (m) found.middleName = m;
    }
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await authService.updateMyProfile({
        firstName: v.firstName,
        lastName: v.lastName,
        ...(USE_MOCKS ? {
          middleName: v.middleName.trim() || null,
          suffix: v.suffix.trim() || null,
        } : {}),
        college: v.college,
        program: v.program,
        yearLevel: Number(v.yearLevel),
      });
      toast.success("Profile updated.");
      await profile.reload();
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page profile-page">
      <PageHero eyebrow="Account" title="My profile" leading={<BackButton fallback={ROUTES.student.dashboard} />} />
      <div className="profile-content">
        <div className="profile-overview">
          <section className="profile-identity" aria-label="Account identity">
            <div className="profile-identity__top">
              <span className="profile-avatar" aria-hidden="true">{initials}</span>
              <div className="profile-identity__name">
                <p className="profile-identity__fullname">{fullName}</p>
                <div className="profile-pills">
                  <StatusBadge status="STUDENT" />
                  {user && <StatusBadge status={user.accountStatus} />}
                </div>
              </div>
            </div>
            <div className="profile-identity__number">
              <div>
                <span className="profile-eyebrow">Student number</span>
                <strong>{p.studentNumber}</strong>
              </div>
              <Barcode className="profile-barcode" size={24} aria-hidden="true" />
            </div>
          </section>

          <Card title="Account" className="profile-account-card">
            <dl className="profile-account-grid">
              <div>
                <dt>Email</dt>
                <dd className="profile-break-value">{p.email}</dd>
              </div>
              <div>
                <dt>Student number</dt>
                <dd className="profile-tabular">{p.studentNumber}</dd>
              </div>
              <div>
                <dt>Account status</dt>
                <dd>{user && <StatusBadge status={user.accountStatus} />}</dd>
              </div>
              <div>
                <dt>Email verified</dt>
                <dd>
                  <span className={`profile-verification ${user?.emailVerified ? "is-verified" : "is-unverified"}`}>
                    {user?.emailVerified ? <CheckCircle2 size={15} aria-hidden="true" /> : <AlertCircle size={15} aria-hidden="true" />}
                    {user?.emailVerified ? "Verified" : "Not yet verified"}
                  </span>
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        <section className="profile-personal-section">
          <header className="profile-content-heading">
            <h2>Personal information</h2>
          </header>
          <Card className="profile-form-card">
            <form className="profile-form" onSubmit={submit} noValidate>
              {!USE_MOCKS && (
                <div className="profile-callout">
                  <Info size={19} aria-hidden="true" />
                  <Alert kind="info">The Server currently supports updating first name, last name, college, course, and year level. Middle name and suffix are read-only.</Alert>
                </div>
              )}
              <div className="profile-form-grid">
                <InputField label="First name" required {...text("firstName")} />
                <InputField label="Last name" required {...text("lastName")} />
                <div className="profile-readonly-field">
                  <InputField label="Middle name" disabled={!USE_MOCKS} {...text("middleName")} />
                  <LockKeyhole className="profile-lock-icon" size={16} aria-hidden="true" />
                </div>
                <div className="profile-readonly-field">
                  <InputField label="Suffix" disabled={!USE_MOCKS} {...text("suffix")} />
                  <LockKeyhole className="profile-lock-icon" size={16} aria-hidden="true" />
                </div>
                <SelectField
                  label="College"
                  required
                  value={v.college}
                  error={errors.college}
                  onChange={(e) => setV({ ...v, college: e.target.value, program: "" })}
                >
                  <option value="">Select your college</option>
                  {MOCK_COLLEGES.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
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
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </SelectField>
                <InputField label="Year level" required type="number" min={1} max={10} {...text("yearLevel")} />
              </div>
              {formError && <Alert kind="error">{formError}</Alert>}
              <div className="profile-form-actions">
                <Button type="submit" loading={busy}>Save changes</Button>
              </div>
            </form>
          </Card>
        </section>

        <Card title="Reading interests" actions={USE_MOCKS ? <Link to={ROUTES.student.interests} className="link-btn">Edit</Link> : undefined}>
          {p.interests.length === 0 ? <p className="subtle">{USE_MOCKS ? "No interests chosen yet." : "Reading interests are not available from the live Server API."}</p> : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {p.interests.map((i) => <span key={i.id} className="badge badge-ok">{i.name}</span>)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}