import { useMemo, useState } from "react";
import Badge from "../../components/Badge";
import DataTable, { type Column } from "../../components/DataTable";
import Modal from "../../components/Modal";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import * as api from "../../services/api";
import type { Signup, SignupDecision, SignupStatus } from "../../types";
import { fmtDate, fmtDateTime } from "../../utils/dates";
import { fullName, indexBy } from "../../utils/lookup";

type TabKey = "review" | "info" | "closed" | "all";
const TABS: Record<TabKey, (s: SignupStatus) => boolean> = {
  review: (s) => s === "For Review",
  info: (s) => s === "Needs Info",
  closed: (s) => s === "Approved" || s === "Rejected",
  all: () => true,
};
const TAB_LABELS: [TabKey, string][] = [["review", "For Review"], ["info", "Needs Info"], ["closed", "Closed"], ["all", "All"]];

function ReviewDialog({ signupId, onClose }: { signupId: number; onClose: () => void }) {
  const { db, user, act, notify } = useAuthedLibrary();
  const s = db.signups.find((x) => x.signup_id === signupId);
  const users = useMemo(() => indexBy(db.users, "user_id"), [db.users]);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, wrap] = useBusy();

  if (!s) return null;

  const history = db.signup_verifications.filter((v) => v.signup_id === s.signup_id);
  const reviewable = s.status === "For Review";

  const decide = (decision: SignupDecision, msg: string) =>
    wrap(async () => {
      const res = await act(api.reviewSignup(user.user_id, s.signup_id, decision, remarks), msg);
      if (res.ok) onClose();
      else setError(res.error);
    });

  return (
    <Modal title={`Signup ${s.reference_no}`} onClose={onClose} wide>
      <dl className="kv">
        <div><dt>Name</dt><dd>{s.first_name} {s.last_name}</dd></div>
        <div><dt>Email</dt><dd>{s.email}</dd></div>
        <div><dt>Student type</dt><dd>{s.student_type}{s.previous_school ? ` (from ${s.previous_school})` : ""}</dd></div>
        <div><dt>Student no. submitted</dt><dd>{s.submitted_student_no ?? "none"}</dd></div>
        <div><dt>Course / year (claimed)</dt><dd>{s.submitted_course ?? "—"} / {s.submitted_year_level ?? "—"}</dd></div>
        <div><dt>Match</dt><dd><Badge status={s.match_status} /> ({s.verification_type})</dd></div>
        <div><dt>Email verified</dt><dd>{s.email_verified_at ? fmtDateTime(s.email_verified_at) : "Not yet"}</dd></div>
        <div><dt>Status</dt><dd><Badge status={s.status} /></dd></div>
        <div>
          <dt>Proof</dt>
          <dd>
            {s.proof_file ?? "none"}{" "}
            {s.proof_file && <button className="text-btn" onClick={() => notify("MOCK — proofs will open through an authenticated endpoint.")}>Open proof</button>}
          </dd>
        </div>
      </dl>
      <h3>History</h3>
      {history.map((v) => (
        <div className="line" key={v.verification_id}>
          <div>
            {v.action}{v.actor_id ? ` by ${fullName(users[v.actor_id])}` : " (applicant)"} ·{" "}
            <span className="muted">{fmtDateTime(v.action_date)}{v.remarks ? ` · ${v.remarks}` : ""}</span>
          </div>
        </div>
      ))}
      {reviewable ? (
        <>
          <label className="field"><span>Remarks (required to reject or request info)</span><textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></label>
          {error && <p className="form-error">{error}</p>}
          <div className="actions-row">
            <button className="btn primary sm" disabled={busy} onClick={decide("Approve", "Application approved.")}>Approve</button>
            <button className="btn ghost sm" disabled={busy} onClick={decide("Info", "More information requested.")}>Request info</button>
            <button className="btn ghost sm danger-text" disabled={busy} onClick={decide("Reject", "Application rejected.")}>Reject</button>
          </div>
        </>
      ) : (
        <p className="muted">{s.remarks ? `Decision remarks: ${s.remarks}` : "This application is not waiting for review."}</p>
      )}
    </Modal>
  );
}

type SignupRow = Signup & { id: number };

export default function Signups() {
  const { db } = useAuthedLibrary();
  const [tab, setTab] = useState<TabKey>("review");
  const [open, setOpen] = useState<number | null>(null);
  const count = (t: TabKey) => db.signups.filter((s) => TABS[t](s.status)).length;

  const rows = useMemo(
    (): SignupRow[] =>
      db.signups
        .filter((s) => TABS[tab](s.status))
        .map((s) => ({ ...s, id: s.signup_id }))
        .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)),
    [db, tab],
  );
  const columns: Column<SignupRow>[] = [
    { key: "reference_no", label: "Reference" },
    { key: "name", label: "Name", render: (s) => `${s.first_name} ${s.last_name}` },
    { key: "email", label: "Email" },
    { key: "student_type", label: "Type" },
    { key: "match_status", label: "Match", render: (s) => <Badge status={s.match_status} /> },
    { key: "submitted_course", label: "Course (claimed)", render: (s) => s.submitted_course ?? "—" },
    { key: "proof_file", label: "Proof", render: (s) => s.proof_file ?? "—" },
    { key: "submitted_at", label: "Submitted", render: (s) => fmtDate(s.submitted_at) },
    { key: "status", label: "Status", render: (s) => <Badge status={s.status} /> },
  ];

  return (
    <>
      <span className="eyebrow">ADMIN</span>
      <h1 className="page-title">Signups</h1>
      <div className="tabs">
        {TAB_LABELS.map(([k, label]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{label} <b>{count(k)}</b></button>
        ))}
      </div>
      <DataTable columns={columns} rows={rows} empty="No applications here." onRowClick={(s) => setOpen(s.signup_id)} />
      {open !== null && <ReviewDialog signupId={open} onClose={() => setOpen(null)} />}
    </>
  );
}