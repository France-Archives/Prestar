import { useMemo, useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import * as api from "../../services/api";
import type { LibrarianFormData, User } from "../../types";
import { fmtDate } from "../../utils/dates";
import { EMAIL, isStrongPassword } from "../../utils/validators";

const EMPTY: LibrarianFormData = { firstName: "", lastName: "", email: "", password: "" };
type LibrarianRow = User & { id: number };

const CARD = "bg-[#FBFAF5] border border-[#D9DDD7] rounded-[14px] shadow-[0_1px_2px_rgba(11,61,50,0.05)]";
const LABEL = "text-xs uppercase tracking-[0.08em] text-[#6B756F] font-medium";
const STAT_VALUE = "font-['Playfair_Display',serif] text-[28px] text-[#0B3D32] mt-1.5 leading-[1.1]";
const PANEL_HEADER =
  "flex flex-wrap justify-between items-baseline gap-2 px-5 py-4 border-b border-[#D9DDD7] bg-[#DCE5D7]";
const PANEL_TITLE = "font-['Playfair_Display',serif] text-xl text-[#07352C] m-0";
const PANEL_NOTE = "mt-1 mb-0 text-sm text-[#6B756F]";

export default function Librarians() {
  const { db, user, act, notify } = useAuthedLibrary();
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState<LibrarianFormData>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<User | null>(null); // librarian whose status is being toggled
  const [busy, wrap] = useBusy();
  const set = (k: keyof LibrarianFormData) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const rows = useMemo((): LibrarianRow[] => db.users.filter((u) => u.role === "Librarian").map((u) => ({ ...u, id: u.user_id })), [db.users]);

  // Summary figures come straight from the existing librarian records.
  const totals = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((u) => u.status === "Active").length,
      inactive: rows.filter((u) => u.status === "Inactive").length,
    }),
    [rows],
  );

  const create = wrap(async () => {
    if (!f.firstName.trim() || !f.lastName.trim()) return setError("Name is required.");
    if (!EMAIL.test(f.email.trim())) return setError("Enter a valid email.");
    if (!isStrongPassword(f.password)) return setError("Initial password: 8+ characters, a letter and a number.");
    const res = await api.createLibrarian(user.user_id, f); // MOCK — the real flow could email a reset link instead
    if (!res.ok) return setError(res.error);
    notify("Librarian created.");
    setCreating(false);
    setF(EMPTY);
    setError(null);
  });

  const toggle = wrap(async () => {
    if (!target) return;
    const next = target.status === "Active" ? "Inactive" : "Active";
    await act(api.setUserStatus(user.user_id, target.user_id, next), `Account ${next === "Active" ? "reactivated" : "set Inactive"}.`);
    setTarget(null);
  });

  const columns: Column<LibrarianRow>[] = [
    { key: "name", label: "Name", render: (u) => `${u.first_name} ${u.last_name}` },
    { key: "email", label: "Email" },
    { key: "status", label: "Status", render: (u) => <Badge status={u.status} /> },
    { key: "created_at", label: "Created", render: (u) => fmtDate(u.created_at) },
    {
      key: "actions",
      label: "",
      render: (u) => (
        <div className="row-actions">
          <button className="btn ghost sm" onClick={() => setTarget(u)}>{u.status === "Active" ? "Set Inactive" : "Reactivate"}</button>
          <button className="btn ghost sm" onClick={() => notify("MOCK — a password reset link would be emailed.")}>Reset password link</button>
        </div>
      ),
    },
  ];

  return (
    <>
      <span className="eyebrow">ADMIN</span>
      <h1 className="page-title">Librarians</h1>
      <p className="text-[#6B756F] mt-1 mb-5 max-w-[680px] leading-relaxed">
        Manage librarian accounts: create new librarians, control who can log in, and send password reset links.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#0B3D32]`}>
          <div className={LABEL}>Librarian accounts</div>
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
      </div>

      <section className={`${CARD} overflow-hidden`}>
        <header className={PANEL_HEADER}>
          <div>
            <h2 className={PANEL_TITLE}>Librarian accounts</h2>
            <p className={PANEL_NOTE}>Accounts with the Librarian role.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] font-medium text-[#1F2A27]">
              {rows.length} {rows.length === 1 ? "librarian" : "librarians"}
            </span>
            <button className="btn primary sm" onClick={() => { setCreating(true); setError(null); }}>Create librarian</button>
          </div>
        </header>

        {/* Desktop and tablet: management table */}
        <div className="hidden md:block overflow-x-auto">
          <DataTable columns={columns} rows={rows} empty="No librarians yet." />
        </div>

        {/* Mobile: account cards */}
        <div className="md:hidden p-3 grid gap-3">
          {rows.length === 0 && <p className="muted text-center py-6 m-0">No librarians yet.</p>}
          {rows.map((u) => (
            <div
              key={u.user_id}
              className={`bg-[#FBFAF5] border border-[#D9DDD7] border-l-4 rounded-[12px] px-4 py-3.5 ${
                u.status === "Active" ? "border-l-[#6F9B78]" : "border-l-[#6B756F]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-['Playfair_Display',serif] text-[17px] text-[#0B3D32] leading-snug truncate">
                    {u.first_name} {u.last_name}
                  </div>
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
                  <dt className={LABEL}>Created</dt>
                  <dd className="m-0 mt-0.5 text-sm text-[#1F2A27]">{fmtDate(u.created_at)}</dd>
                </div>
              </dl>

              <div className="row-actions mt-3 pt-3 border-t border-[#D9DDD7] flex flex-wrap gap-2">
                <button className="btn ghost sm" onClick={() => setTarget(u)}>{u.status === "Active" ? "Set Inactive" : "Reactivate"}</button>
                <button className="btn ghost sm" onClick={() => notify("MOCK — a password reset link would be emailed.")}>Reset password link</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {creating && (
        <ConfirmDialog title="Create librarian" confirmLabel="Create" busy={busy} onConfirm={create} onClose={() => setCreating(false)}>
          <div className="row">
            <label className="field"><span>First name</span><input value={f.firstName} onChange={set("firstName")} /></label>
            <label className="field"><span>Last name</span><input value={f.lastName} onChange={set("lastName")} /></label>
          </div>
          <label className="field"><span>Email</span><input type="email" value={f.email} onChange={set("email")} /></label>
          <label className="field"><span>Initial password</span><input type="password" value={f.password} onChange={set("password")} /></label>
          {error && <p className="form-error">{error}</p>}
        </ConfirmDialog>
      )}

      {target && (
        <ConfirmDialog title={target.status === "Active" ? "Set Inactive?" : "Reactivate account?"} danger={target.status === "Active"} busy={busy} onConfirm={toggle} onClose={() => setTarget(null)}>
          <p>{target.first_name} {target.last_name} {target.status === "Active" ? "will no longer be able to log in." : "will be able to log in again."}</p>
        </ConfirmDialog>
      )}
    </>
  );
}