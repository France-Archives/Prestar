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

export default function Librarians() {
  const { db, user, act, notify } = useAuthedLibrary();
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState<LibrarianFormData>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<User | null>(null); // librarian whose status is being toggled
  const [busy, wrap] = useBusy();
  const set = (k: keyof LibrarianFormData) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const rows = useMemo((): LibrarianRow[] => db.users.filter((u) => u.role === "Librarian").map((u) => ({ ...u, id: u.user_id })), [db.users]);

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
      <div className="toolbar">
        <button className="btn primary sm" onClick={() => { setCreating(true); setError(null); }}>Create librarian</button>
      </div>
      <DataTable columns={columns} rows={rows} empty="No librarians yet." />

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