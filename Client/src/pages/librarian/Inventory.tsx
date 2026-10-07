import { useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import { useLive } from "../../hooks/useLive";
import * as api from "../../services/api";
import * as lib from "../../services/librarian";
import type { ConditionStatus, CopyStatus } from "../../types";

// Physical copies only. A copy that is Borrowed can only change through Issue / Returns.
const MOVES: Partial<Record<CopyStatus, { to: CopyStatus; label: string }[]>> = {
  Available: [{ to: "Maintenance", label: "Send to maintenance" }, { to: "Lost", label: "Mark lost" }],
  Maintenance: [{ to: "Available", label: "Back to shelf" }, { to: "Lost", label: "Mark lost" }],
};

export default function Inventory() {
  const { user, act } = useAuthedLibrary();
  const copies = useLive(() => lib.getCopyRows());
  const books = useLive(lib.getCatalogRows);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [adding, setAdding] = useState(false);
  const [bookId, setBookId] = useState("");
  const [accession, setAccession] = useState("");
  const [condition, setCondition] = useState<ConditionStatus>("Good");
  const [error, setError] = useState<string | null>(null);
  const [busy, wrap] = useBusy();

  const term = q.trim().toLowerCase();
  const rows = copies.filter((c) => (status === "all" || c.status === status) && (!term || c.book.toLowerCase().includes(term) || c.accessionNo.toLowerCase().includes(term)));

  const add = wrap(async () => {
    const res = await act(api.addCopy(user.user_id, { bookId: Number(bookId), accessionNo: accession, condition }), "Copy added.");
    if (!res.ok) return setError(res.error);
    setAdding(false);
    setAccession("");
  });
  const move = (copyId: number, to: CopyStatus) => act(api.updateCopy(user.user_id, copyId, { status: to }), `Copy marked ${to}.`);
  const setCond = (copyId: number, c: ConditionStatus) => act(api.updateCopy(user.user_id, copyId, { condition_status: c }), "Condition updated.");

  const columns: Column<lib.CopyRow>[] = [
    { key: "accessionNo", label: "Copy ID" },
    { key: "book", label: "Book" },
    { key: "location", label: "Location" },
    {
      key: "condition",
      label: "Condition",
      render: (c) => (
        <select className="input" value={c.condition} onChange={(e) => setCond(c.id, e.target.value as ConditionStatus)} aria-label={`Condition of ${c.accessionNo}`}>
          <option>Good</option>
          <option>Damaged</option>
        </select>
      ),
    },
    { key: "status", label: "Status", render: (c) => <Badge status={c.status} /> },
    { key: "borrower", label: "Borrowed by" },
    {
      key: "actions",
      label: "",
      render: (c) => (
        <div className="row-actions">
          {(MOVES[c.status] ?? []).map((m) => (
            <button key={m.to} className="btn ghost sm" onClick={() => move(c.id, m.to)}>{m.label}</button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <>
      <span className="eyebrow">LIBRARIAN</span>
      <h1 className="page-title">Inventory</h1>
      <div className="toolbar">
        <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search book or copy ID…" />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option>Available</option>
          <option>Borrowed</option>
          <option>Maintenance</option>
          <option>Lost</option>
        </select>
        <button className="btn primary sm" onClick={() => { setAdding(true); setError(null); }}>Add copy</button>
      </div>
      <DataTable columns={columns} rows={rows} empty="No copies match." />

      {adding && (
        <ConfirmDialog title="Add a physical copy" confirmLabel="Add copy" busy={busy} onConfirm={add} onClose={() => setAdding(false)}>
          <label className="field">
            <span>Book</span>
            <select value={bookId} onChange={(e) => setBookId(e.target.value)}>
              <option value="">Choose…</option>
              {books.filter((b) => b.status === "Active").map((b) => <option key={b.book_id} value={b.book_id}>{b.title}</option>)}
            </select>
          </label>
          <div className="row">
            <label className="field"><span>Accession / barcode</span><input value={accession} onChange={(e) => setAccession(e.target.value)} /></label>
            <label className="field">
              <span>Condition</span>
              <select value={condition} onChange={(e) => setCondition(e.target.value as ConditionStatus)}>
                <option>Good</option>
                <option>Damaged</option>
              </select>
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
        </ConfirmDialog>
      )}
    </>
  );
}