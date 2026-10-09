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

const CARD = "bg-[#FBFAF5] border border-[#D9DDD7] rounded-[14px] shadow-[0_1px_2px_rgba(11,61,50,0.05)]";
const LABEL = "text-xs uppercase tracking-[0.08em] text-[#6B756F] font-medium";
const STAT_VALUE = "font-['Playfair_Display',serif] text-[28px] text-[#0B3D32] mt-1.5 leading-[1.1]";
const PANEL_HEADER =
  "flex flex-wrap justify-between items-baseline gap-2 px-5 py-4 border-b border-[#D9DDD7] bg-[#DCE5D7]";
const PANEL_TITLE = "font-['Playfair_Display',serif] text-xl text-[#07352C] m-0";
const PANEL_NOTE = "mt-1 mb-0 text-sm text-[#6B756F]";
const SUB_PANEL = "bg-[#FBFAF5] border border-[#D9DDD7] rounded-[12px] overflow-hidden";
const SUB_HEADER = "px-4 py-3 border-b border-[#D9DDD7] bg-[#DCE5D7] font-['Playfair_Display',serif] text-base text-[#07352C]";
const FIELD_ROW = "flex flex-col gap-0.5 px-4 py-2.5 border-b border-[#D9DDD7] last:border-b-0";
const FIELD_VALUE = "text-sm text-[#1F2A27] break-words";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={FIELD_ROW}>
      <dt className={LABEL}>{label}</dt>
      <dd className={`${FIELD_VALUE} m-0`}>{children}</dd>
    </div>
  );
}

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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className={LABEL}>Applicant</div>
          <div className="font-['Playfair_Display',serif] text-xl text-[#0B3D32]">
            {s.first_name} {s.last_name}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={LABEL}>Status</span>
          <Badge status={s.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className={SUB_PANEL}>
          <h3 className={`${SUB_HEADER} m-0`}>Student information</h3>
          <dl className="m-0">
            <Field label="Name">{s.first_name} {s.last_name}</Field>
            <Field label="Email">{s.email}</Field>
            <Field label="Student type">
              {s.student_type}
              {s.previous_school ? ` (from ${s.previous_school})` : ""}
            </Field>
            <Field label="Email verified">
              {s.email_verified_at ? fmtDateTime(s.email_verified_at) : "Not yet"}
            </Field>
          </dl>
        </section>

        <section className={SUB_PANEL}>
          <h3 className={`${SUB_HEADER} m-0`}>Submitted information</h3>
          <dl className="m-0">
            <Field label="Student no. submitted">{s.submitted_student_no ?? "none"}</Field>
            <Field label="Course (claimed)">{s.submitted_course ?? "—"}</Field>
            <Field label="Year level (claimed)">{s.submitted_year_level ?? "—"}</Field>
            <Field label="Match">
              <span className="inline-flex flex-wrap items-center gap-2">
                <Badge status={s.match_status} />
                <span className="text-[#6B756F]">({s.verification_type})</span>
              </span>
            </Field>
          </dl>
        </section>
      </div>

      <section className={`${SUB_PANEL} mt-4`}>
        <h3 className={`${SUB_HEADER} m-0`}>Submitted document</h3>
        <div className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className={LABEL}>Proof file</div>
            <div className={`${FIELD_VALUE} mt-0.5`}>{s.proof_file ?? "none"}</div>
          </div>
          {s.proof_file && (
            <button
              className="btn ghost sm"
              onClick={() => notify("MOCK — proofs will open through an authenticated endpoint.")}
            >
              Open proof
            </button>
          )}
        </div>
      </section>

      <h3 className="font-['Playfair_Display',serif] text-lg text-[#07352C] mt-6 mb-2">Review history</h3>
      {history.length === 0 ? (
        <p className="muted">No history yet.</p>
      ) : (
        <div className="grid gap-2">
          {history.map((v) => (
            <div
              className="border border-[#D9DDD7] border-l-4 border-l-[#6F9B78] bg-[#F5F3EA] rounded-[10px] px-3.5 py-2.5 text-sm text-[#1F2A27]"
              key={v.verification_id}
            >
              <b className="text-[#0B3D32]">{v.action}</b>
              {v.actor_id ? ` by ${fullName(users[v.actor_id])}` : " (applicant)"}
              <div className="text-[13px] text-[#6B756F] mt-0.5">
                {fmtDateTime(v.action_date)}
                {v.remarks ? ` · ${v.remarks}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewable ? (
        <div className="mt-6 pt-5 border-t border-[#D9DDD7]">
          <label className="field">
            <span>Remarks (required to reject or request info)</span>
            <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="actions-row">
            <button className="btn primary sm" disabled={busy} onClick={decide("Approve", "Application approved.")}>Approve</button>
            <button className="btn ghost sm" disabled={busy} onClick={decide("Info", "More information requested.")}>Request info</button>
            <button className="btn ghost sm danger-text" disabled={busy} onClick={decide("Reject", "Application rejected.")}>Reject</button>
          </div>
        </div>
      ) : (
        <p className="mt-6 px-4 py-3 rounded-[10px] border border-[#D9C19A] bg-[#F5F3EA] text-sm text-[#1F2A27]">
          {s.remarks ? `Decision remarks: ${s.remarks}` : "This application is not waiting for review."}
        </p>
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

  const activeLabel = TAB_LABELS.find(([k]) => k === tab)?.[1] ?? "";

  return (
    <>
      <span className="eyebrow">ADMIN</span>
      <h1 className="page-title">Signups</h1>
      <p className="text-[#6B756F] mt-1 mb-5 max-w-[680px] leading-relaxed">
        Review student applications that need manual verification, compare submitted details with the proof provided, and record a decision.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#B98A4A]`}>
          <div className={LABEL}>For review</div>
          <div className={STAT_VALUE}>{count("review")}</div>
        </div>
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#D9C19A]`}>
          <div className={LABEL}>Needs info</div>
          <div className={STAT_VALUE}>{count("info")}</div>
        </div>
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#6F9B78]`}>
          <div className={LABEL}>Closed</div>
          <div className={STAT_VALUE}>{count("closed")}</div>
        </div>
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#0B3D32]`}>
          <div className={LABEL}>All applications</div>
          <div className={STAT_VALUE}>{count("all")}</div>
        </div>
      </div>

      <div className="tabs">
        {TAB_LABELS.map(([k, label]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{label} <b>{count(k)}</b></button>
        ))}
      </div>

      <section className={`${CARD} overflow-hidden mt-5`}>
        <header className={PANEL_HEADER}>
          <div>
            <h2 className={PANEL_TITLE}>{activeLabel}</h2>
            <p className={PANEL_NOTE}>Select an application to open the verification workspace.</p>
          </div>
          <span className="text-[13px] font-medium text-[#1F2A27]">
            {rows.length} {rows.length === 1 ? "application" : "applications"}
          </span>
        </header>

        {/* Desktop and tablet: review table */}
        <div className="hidden md:block overflow-x-auto">
          <DataTable columns={columns} rows={rows} empty="No applications here." onRowClick={(s) => setOpen(s.signup_id)} />
        </div>

        {/* Mobile: application cards */}
        <div className="md:hidden p-3 grid gap-3">
          {rows.length === 0 && <p className="muted text-center py-6 m-0">No applications here.</p>}
          {rows.map((s) => (
            <button
              key={s.signup_id}
              type="button"
              onClick={() => setOpen(s.signup_id)}
              className="w-full text-left bg-[#FBFAF5] border border-[#D9DDD7] border-l-4 border-l-[#B98A4A] rounded-[12px] px-4 py-3.5 cursor-pointer transition-colors hover:bg-[#F5F3EA]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-['Playfair_Display',serif] text-[17px] text-[#0B3D32] leading-snug truncate">
                    {s.first_name} {s.last_name}
                  </div>
                  <div className="text-[13px] text-[#6B756F] truncate">{s.email}</div>
                </div>
                <Badge status={s.status} />
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-3 mb-0">
                <div>
                  <dt className={LABEL}>Reference</dt>
                  <dd className="m-0 mt-0.5 text-sm text-[#1F2A27] break-words">{s.reference_no}</dd>
                </div>
                <div>
                  <dt className={LABEL}>Type</dt>
                  <dd className="m-0 mt-0.5 text-sm text-[#1F2A27]">{s.student_type}</dd>
                </div>
                <div>
                  <dt className={LABEL}>Match</dt>
                  <dd className="m-0 mt-0.5 text-sm text-[#1F2A27]"><Badge status={s.match_status} /></dd>
                </div>
                <div>
                  <dt className={LABEL}>Submitted</dt>
                  <dd className="m-0 mt-0.5 text-sm text-[#1F2A27]">{fmtDate(s.submitted_at)}</dd>
                </div>
                <div>
                  <dt className={LABEL}>Course (claimed)</dt>
                  <dd className="m-0 mt-0.5 text-sm text-[#1F2A27]">{s.submitted_course ?? "—"}</dd>
                </div>
                <div>
                  <dt className={LABEL}>Proof</dt>
                  <dd className="m-0 mt-0.5 text-sm text-[#1F2A27] break-words">{s.proof_file ?? "—"}</dd>
                </div>
              </dl>

              <div className="mt-3 pt-3 border-t border-[#D9DDD7] text-[13px] font-medium text-[#0B3D32]">
                Open verification →
              </div>
            </button>
          ))}
        </div>
      </section>

      {open !== null && <ReviewDialog signupId={open} onClose={() => setOpen(null)} />}
    </>
  );
}