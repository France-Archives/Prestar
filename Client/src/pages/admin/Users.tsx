import { useMemo, useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import Modal from "../../components/Modal";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import * as api from "../../services/api";
import { standingOf } from "../../services/reports";
import type { ApiResult, EligibilityCode, Standing, Suspension, SuspensionFormData, SuspensionReason, User, UserRole } from "../../types";
import { fmtDate } from "../../utils/dates";
import { fullName, indexBy } from "../../utils/lookup";

const CHECKS: Record<EligibilityCode, string> = {
  A: "Account is Active",
  B: "Enrolled (or provisional access valid)",
  C: "No active suspension",
  D: "No unpaid penalty",
  E: "No overdue loan",
  F: "Within loan and reservation limits",
};
const ROLE_OPTIONS: UserRole[] = ["Student", "Librarian", "Admin"];
const REASON_OPTIONS: SuspensionReason[] = ["Violation", "Lost Book", "Damaged Book", "Other"];
const STANDING_OPTIONS: Standing[] = ["OK", "Suspended", "Penalty", "Overdue", "Not enrolled", "Inactive"];

const CARD = "bg-[#FBFAF5] border border-[#D9DDD7] rounded-[14px] shadow-[0_1px_2px_rgba(11,61,50,0.05)]";
const LABEL = "text-xs uppercase tracking-[0.08em] text-[#6B756F] font-medium";
const STAT_VALUE = "font-['Playfair_Display',serif] text-[28px] text-[#0B3D32] mt-1.5 leading-[1.1]";
const PANEL_HEADER =
  "flex flex-wrap justify-between items-baseline gap-2 px-5 py-4 border-b border-[#D9DDD7] bg-[#DCE5D7]";
const PANEL_TITLE = "font-['Playfair_Display',serif] text-xl text-[#07352C] m-0";
const PANEL_NOTE = "mt-1 mb-0 text-sm text-[#6B756F]";

type Dialog = null | "status" | "role" | "suspend" | { lift: Suspension };

function UserDetails({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { db, user: me, act } = useAuthedLibrary();
  const u = db.users.find((x) => x.user_id === userId);
  const [dlg, setDlg] = useState<Dialog>(null);
  const [role, setRole] = useState<UserRole>(u?.role ?? "Student");
  const [sus, setSus] = useState<SuspensionFormData>({ reasonType: "Violation", reasonDetails: "", endDate: "" });
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, wrap] = useBusy();
  const books = useMemo(() => indexBy(db.books, "book_id"), [db.books]);

  if (!u) return null;

  const student = u.role === "Student";
  const all = student ? [...api.checkEligibility(u.user_id, "request"), ...api.checkEligibility(u.user_id, "reserve")] : [];
  const suspensions = db.suspensions.filter((s) => s.user_id === u.user_id);
  const penalties = db.penalties.filter((p) => p.user_id === u.user_id);
  const loans = db.borrowed_books.filter((l) => l.user_id === u.user_id);
  const signup = db.signups.find((s) => s.created_user_id === u.user_id);
  const openReqs = db.borrow_requests.filter((r) => r.user_id === u.user_id && ["Pending", "Approved"].includes(r.status)).length;
  const openRes = db.reservations.filter((r) => r.user_id === u.user_id && ["Waiting", "Ready"].includes(r.status)).length;
  const next = u.status === "Active" ? "Inactive" : "Active";
  const lifting = typeof dlg === "object" && dlg !== null ? dlg.lift : null;

  const close = () => {
    setDlg(null);
    setError(null);
    setRemarks("");
  };
  const run = wrap(async (call: Promise<ApiResult<unknown>>, msg: string) => {
    const res = await act(call, msg);
    if (res.ok) close();
    else setError(res.error);
  });

  return (
    <Modal title={fullName(u)} onClose={onClose} wide>
      <dl className="kv">
        <div><dt>Email</dt><dd>{u.email}</dd></div>
        <div><dt>Role</dt><dd>{u.role}</dd></div>
        <div><dt>Account status</dt><dd><Badge status={u.status} /></dd></div>
        {student && <div><dt>Student ID</dt><dd>{u.student_id ?? "Provisional"}</dd></div>}
        {student && !u.student_id && <div><dt>Temporary access until</dt><dd>{fmtDate(u.manual_verified_until)}</dd></div>}
        <div><dt>Created</dt><dd>{fmtDate(u.created_at)}</dd></div>
        {signup && <div><dt>Signup</dt><dd>{signup.reference_no} · proof: {signup.proof_file ?? "none"}</dd></div>}
      </dl>

      {student && (
        <>
          <h3>Eligibility checklist</h3>
          <ul className="plain">
            {(Object.keys(CHECKS) as EligibilityCode[]).map((code) => {
              const bad = all.find((r) => r.code === code);
              return (
                <li key={code}>
                  {bad ? "✗" : "✓"} <b>{code}</b> {CHECKS[code]}
                  {bad && <span className="reason"> — {bad.message}</span>}
                </li>
              );
            })}
          </ul>

          <h3>Suspensions</h3>
          {suspensions.length === 0 ? (
            <p className="muted">None.</p>
          ) : (
            suspensions.map((s) => (
              <div className="line" key={s.suspension_id}>
                <div>
                  <Badge status={s.status} /> {s.reason_type}: {s.reason_details}
                  <br />
                  <span className="muted">{fmtDate(s.start_date)} → {s.end_date ? fmtDate(s.end_date) : "until lifted"}</span>
                </div>
                {s.status === "Active" && <button className="btn ghost sm" onClick={() => setDlg({ lift: s })}>Lift</button>}
              </div>
            ))
          )}

          <h3>Penalties</h3>
          {penalties.length === 0 ? (
            <p className="muted">None.</p>
          ) : (
            penalties.map((p) => (
              <div className="line" key={p.penalty_id}>
                <div>{p.penalty_type} · {p.amount.toFixed(2)} · <Badge status={p.status} /></div>
              </div>
            ))
          )}

          <h3>Loans ({loans.length})</h3>
          {loans.length === 0 ? (
            <p className="muted">No loans.</p>
          ) : (
            loans.map((l) => (
              <div className="line" key={l.borrow_id}>
                <div>{books[l.book_id].title} · due {fmtDate(l.due_date)} · <Badge status={api.isOverdue(l) ? "Overdue" : l.status} /></div>
              </div>
            ))
          )}
        </>
      )}

      <div className="actions-row">
        <button className={`btn sm ${u.status === "Active" ? "ghost" : "primary"}`} onClick={() => setDlg("status")}>
          {u.status === "Active" ? "Set Inactive" : "Reactivate account"}
        </button>
        <button className="btn ghost sm" onClick={() => setDlg("role")}>Change role</button>
        {student && <button className="btn ghost sm" onClick={() => setDlg("suspend")}>Suspend student</button>}
      </div>

      {dlg === "status" && (
        <ConfirmDialog
          title={`${next === "Inactive" ? "Set Inactive" : "Reactivate"}: ${fullName(u)}`}
          confirmLabel="Confirm"
          danger={next === "Inactive"}
          busy={busy}
          onClose={close}
          onConfirm={() => run(api.setUserStatus(me.user_id, u.user_id, next), `Account ${next === "Inactive" ? "set Inactive" : "reactivated"}.`)}
        >
          {next === "Inactive" ? (
            <p>This will cancel {openReqs} open request{openReqs === 1 ? "" : "s"} and {openRes} reservation{openRes === 1 ? "" : "s"}. Active loans stay and must be returned. The user will not be able to log in.</p>
          ) : (
            <p>The user will be able to log in again.</p>
          )}
          {error && <p className="form-error">{error}</p>}
        </ConfirmDialog>
      )}

      {dlg === "role" && (
        <ConfirmDialog title="Change role" busy={busy} onClose={close} confirmDisabled={role === u.role} onConfirm={() => run(api.changeRole(me.user_id, u.user_id, role), "Role updated.")}>
          <label className="field">
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              {ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          {error && <p className="form-error">{error}</p>}
        </ConfirmDialog>
      )}

      {dlg === "suspend" && (
        <ConfirmDialog title="Suspend student" confirmLabel="Suspend" danger busy={busy} onClose={close} onConfirm={() => run(api.createSuspension(me.user_id, { userId: u.user_id, ...sus }), "Student suspended.")}>
          <label className="field">
            <span>Reason type</span>
            <select value={sus.reasonType} onChange={(e) => setSus({ ...sus, reasonType: e.target.value as SuspensionReason })}>
              {REASON_OPTIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label className="field"><span>Details</span><textarea rows={3} value={sus.reasonDetails} onChange={(e) => setSus({ ...sus, reasonDetails: e.target.value })} /></label>
          <label className="field"><span>End date (empty = until lifted)</span><input type="date" value={sus.endDate} onChange={(e) => setSus({ ...sus, endDate: e.target.value })} /></label>
          {error && <p className="form-error">{error}</p>}
        </ConfirmDialog>
      )}

      {lifting && (
        <ConfirmDialog title="Lift suspension" confirmLabel="Lift" busy={busy} onClose={close} onConfirm={() => run(api.liftSuspension(me.user_id, lifting.suspension_id, remarks), "Suspension lifted.")}>
          <label className="field"><span>Remarks (optional)</span><textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></label>
          {error && <p className="form-error">{error}</p>}
        </ConfirmDialog>
      )}
    </Modal>
  );
}

type UserRow = User & { id: number; name: string; standing: Standing };

export default function Users() {
  const { db } = useAuthedLibrary();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [standing, setStanding] = useState("all");
  const [prov, setProv] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const rows = useMemo((): UserRow[] => {
    const term = q.trim().toLowerCase();
    return db.users
      .map((u) => ({ ...u, id: u.user_id, name: fullName(u), standing: standingOf(u.user_id) }))
      .filter(
        (u) =>
          (!term || [u.name, u.email, u.student_id ?? ""].some((s) => s.toLowerCase().includes(term))) &&
          (role === "all" || u.role === role) &&
          (status === "all" || u.status === status) &&
          (standing === "all" || u.standing === standing) &&
          (!prov || (u.role === "Student" && !u.student_id)),
      );
  }, [db, q, role, status, standing, prov]);

  // Summary figures come straight from the existing user records.
  const totals = useMemo(
    () => ({
      all: db.users.length,
      active: db.users.filter((u) => u.status === "Active").length,
      inactive: db.users.filter((u) => u.status === "Inactive").length,
      provisional: db.users.filter((u) => u.role === "Student" && !u.student_id).length,
    }),
    [db.users],
  );

  const columns: Column<UserRow>[] = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role" },
    { key: "status", label: "Status", render: (u) => <Badge status={u.status} /> },
    { key: "student_id", label: "Student ID", render: (u) => u.student_id ?? (u.role === "Student" ? "Provisional" : "—") },
    { key: "standing", label: "Borrowing standing", render: (u) => (u.standing === "—" ? "—" : <Badge status={u.standing} />) },
    { key: "created_at", label: "Created", render: (u) => fmtDate(u.created_at) },
  ];

  const hasFilters = Boolean(q || role !== "all" || status !== "all" || standing !== "all" || prov);

  return (
    <>
      <span className="eyebrow">ADMIN</span>
      <h1 className="page-title">Users</h1>
      <p className="text-[#6B756F] mt-1 mb-5 max-w-[680px] leading-relaxed">
        Review student, librarian and administrator accounts, check verification and standing, and open an account to manage it.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#0B3D32]`}>
          <div className={LABEL}>Total users</div>
          <div className={STAT_VALUE}>{totals.all}</div>
        </div>
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#6F9B78]`}>
          <div className={LABEL}>Active</div>
          <div className={STAT_VALUE}>{totals.active}</div>
        </div>
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#6B756F]`}>
          <div className={LABEL}>Inactive</div>
          <div className={STAT_VALUE}>{totals.inactive}</div>
        </div>
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#B98A4A]`}>
          <div className={LABEL}>Provisional students</div>
          <div className={STAT_VALUE}>{totals.provisional}</div>
        </div>
      </div>

      <div className={`toolbar ${CARD} px-[18px] py-3.5 mb-5 flex flex-wrap items-center gap-3`}>
        <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or student ID…" />
        <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">All roles</option>
          {ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
        <select className="input" value={standing} onChange={(e) => setStanding(e.target.value)}>
          <option value="all">All standings</option>
          {STANDING_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={prov} onChange={(e) => setProv(e.target.checked)} /><span>Provisional only</span></label>
      </div>

      <section className={`${CARD} overflow-hidden`}>
        <header className={PANEL_HEADER}>
          <div>
            <h2 className={PANEL_TITLE}>Accounts</h2>
            <p className={PANEL_NOTE}>Select a row to view details and manage the account.</p>
          </div>
          <span className="text-[13px] font-medium text-[#1F2A27]">
            {rows.length} {rows.length === 1 ? "user" : "users"}
            {hasFilters ? " (filtered)" : ""}
          </span>
        </header>

        {/* Desktop and tablet: management table */}
        <div className="hidden md:block overflow-x-auto">
          <DataTable columns={columns} rows={rows} empty="No users match." onRowClick={(u) => setOpen(u.user_id)} />
        </div>

        {/* Mobile: account cards */}
        <div className="md:hidden p-3 grid gap-3">
          {rows.length === 0 && <p className="muted text-center py-6 m-0">No users match.</p>}
          {rows.map((u) => (
            <button
              key={u.user_id}
              type="button"
              onClick={() => setOpen(u.user_id)}
              className={`w-full text-left bg-[#FBFAF5] border border-[#D9DDD7] border-l-4 rounded-[12px] px-4 py-3.5 cursor-pointer transition-colors hover:bg-[#F5F3EA] ${
                u.status === "Active" ? "border-l-[#6F9B78]" : "border-l-[#6B756F]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-['Playfair_Display',serif] text-[17px] text-[#0B3D32] leading-snug truncate">{u.name}</div>
                  <div className="text-[13px] text-[#6B756F] truncate">{u.email}</div>
                </div>
                <Badge status={u.status} />
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-3 mb-0">
                <div>
                  <dt className={LABEL}>Role</dt>
                  <dd className="m-0 mt-0.5 text-sm text-[#1F2A27]">{u.role}</dd>
                </div>
                <div>
                  <dt className={LABEL}>Student ID</dt>
                  <dd className="m-0 mt-0.5 text-sm text-[#1F2A27]">
                    {u.student_id ?? (u.role === "Student" ? "Provisional" : "—")}
                  </dd>
                </div>
                <div>
                  <dt className={LABEL}>Borrowing standing</dt>
                  <dd className="m-0 mt-0.5 text-sm text-[#1F2A27]">
                    {u.standing === "—" ? "—" : <Badge status={u.standing} />}
                  </dd>
                </div>
                <div>
                  <dt className={LABEL}>Created</dt>
                  <dd className="m-0 mt-0.5 text-sm text-[#1F2A27]">{fmtDate(u.created_at)}</dd>
                </div>
              </dl>

              <div className="mt-3 pt-3 border-t border-[#D9DDD7] text-[13px] font-medium text-[#0B3D32]">
                View details and manage →
              </div>
            </button>
          ))}
        </div>
      </section>

      {open !== null && <UserDetails userId={open} onClose={() => setOpen(null)} />}
    </>
  );
}