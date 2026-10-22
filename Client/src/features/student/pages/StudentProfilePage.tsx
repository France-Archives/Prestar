import { Link } from "react-router-dom";
import { AlertCircle, Barcode, CheckCircle2, Info, LockKeyhole } from "lucide-react";
import Alert from "@/components/feedback/Alert";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { MOCK_COLLEGES } from "@/data";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import * as authService from "@/services/authService";
import { USE_MOCKS } from "@/utils/constants";
import "@/styles/profile.css";

export default function StudentProfilePage() {
  const { user } = useAuth();
  const profile = useAsync(() => authService.getMyProfile(), []);

  if (profile.loading) return <div className="page"><LoadingState rows={4} /></div>;
  if (profile.error || !profile.data) return <div className="page"><ErrorState message={profile.error ?? "Could not load your profile."} onRetry={() => void profile.reload()} /></div>;
  const p = profile.data;

  const college =
    p.college ?? MOCK_COLLEGES.find((c) => c.courses.some((x) => x.name === p.program))?.name ?? "—";
  const fullName = [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(" ");
  const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();

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
            <div className="profile-form">
              <div className="profile-callout">
                <Info size={19} aria-hidden="true" />
                <Alert kind="info">Your personal information is managed by the library. To request a correction, please contact library staff.</Alert>
              </div>
              <div className="profile-form-grid">
                <ReadonlyProfileField label="First name" value={p.firstName} />
                <ReadonlyProfileField label="Last name" value={p.lastName} />
                <ReadonlyProfileField label="Middle name" value={p.middleName || "—"} />
                <ReadonlyProfileField label="Suffix" value={p.suffix || "—"} />
                <ReadonlyProfileField label="College" value={college} />
                <ReadonlyProfileField label="Course" value={p.program || "—"} />
                <ReadonlyProfileField label="Year level" value={p.yearLevel ? String(p.yearLevel) : "—"} />
              </div>
            </div>
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

function ReadonlyProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="field profile-display-field">
      <span className="label">{label}</span>
      <div className="profile-readonly-value">
        <span>{value}</span>
        <LockKeyhole size={16} aria-hidden="true" />
      </div>
    </div>
  );
}