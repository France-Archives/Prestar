import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import { InputField } from "@/components/forms/FormField";
import LoadingState from "@/components/feedback/LoadingState";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import * as authService from "@/services/authService";
import { describeError } from "@/utils/errors";
import { validateName, validateYearLevel } from "@/utils/validators";

// Email and student number are not editable here (email-change policy is TO CONFIRM, TC-03).
export default function StudentProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const profile = useAsync(() => authService.getMyProfile(), []);
  const [v, setV] = useState({ firstName: "", middleName: "", lastName: "", suffix: "", program: "", yearLevel: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = profile.data;
    if (p) setV({ firstName: p.firstName, middleName: p.middleName ?? "", lastName: p.lastName, suffix: p.suffix ?? "", program: p.program ?? "", yearLevel: p.yearLevel ? String(p.yearLevel) : "" });
  }, [profile.data]);

  if (profile.loading) return <div className="page"><LoadingState rows={4} /></div>;
  if (profile.error || !profile.data) return <div className="page"><ErrorState message={profile.error ?? "Could not load your profile."} onRetry={() => void profile.reload()} /></div>;
  const p = profile.data;

  const text = (key: keyof typeof v) => ({ value: v[key], error: errors[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [key]: e.target.value }) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    const checks: [string, string | null][] = [
      ["firstName", validateName(v.firstName, "First name")],
      ["lastName", validateName(v.lastName, "Last name")],
      ["yearLevel", validateYearLevel(v.yearLevel)],
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
        middleName: v.middleName.trim() || null,
        lastName: v.lastName,
        suffix: v.suffix.trim() || null,
        program: v.program.trim() || null,
        yearLevel: v.yearLevel.trim() ? Number(v.yearLevel) : null,
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
    <div className="page" style={{ maxWidth: 860 }}>
      <PageHeader eyebrow="Account" title="My profile" />
      <div className="stack">
        <Card title="Account">
          <dl className="kv">
            <div><dt>Email</dt><dd>{p.email}</dd></div>
            <div><dt>Student number</dt><dd>{p.studentNumber}</dd></div>
            <div><dt>Account status</dt><dd>{user && <StatusBadge status={user.accountStatus} />}</dd></div>
            <div><dt>Email verified</dt><dd>{user?.emailVerifiedAt ? "Yes" : "Not yet"}</dd></div>
          </dl>
        </Card>
        <Card title="Personal information">
          <form className="stack" onSubmit={submit} noValidate>
            <div className="form-row">
              <InputField label="First name" required {...text("firstName")} />
              <InputField label="Last name" required {...text("lastName")} />
            </div>
            <div className="form-row">
              <InputField label="Middle name" {...text("middleName")} />
              <InputField label="Suffix" {...text("suffix")} />
            </div>
            <div className="form-row">
              <InputField label="Program" {...text("program")} />
              <InputField label="Year level" type="number" min={1} max={10} {...text("yearLevel")} />
            </div>
            {formError && <Alert kind="error">{formError}</Alert>}
            <div><Button type="submit" loading={busy}>Save changes</Button></div>
          </form>
        </Card>
        <Card title="Reading interests" actions={<Link to={ROUTES.student.interests} className="link-btn">Edit</Link>}>
          {p.interests.length === 0 ? <p className="subtle">No interests chosen yet.</p> : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {p.interests.map((i) => <span key={i.id} className="badge badge-ok">{i.name}</span>)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}