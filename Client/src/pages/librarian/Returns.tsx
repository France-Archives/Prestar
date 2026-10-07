import { useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import { useLive } from "../../hooks/useLive";
import * as api from "../../services/api";
import * as lib from "../../services/librarian";
import type { ConditionStatus } from "../../types";

type Dialog = { kind: "return" | "lost"; row: lib.LoanRow } | null;

// Receiving a book never gets blocked by overdue, penalties or suspension. A Good return makes the copy AVAILABLE.
export default function Returns() {
  const { user, act } = useAuthedLibrary();
  const loans = useLive(lib.getOpenLoans);
  const recent = useLive(lib.getRecentReturns);
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [condition, setCondition] = useState<ConditionStatus>("Good");
  const [scanned, setScanned] = useState("");
  const [remarks, setRemarks] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, wrap] = useBusy();

  const term = q.trim().toLowerCase();
  const rows = loans.filter((l) => !term || [l.student, l.book, l.accessionNo].some((s) => s.toLowerCase().includes(term)));

  const open = (kind: "return" | "lost", row: lib.LoanRow) => {
    setDialog({ kind, row });
    setCondition("Good");
    setScanned("");
    setRemarks("");
    setAmount("");
  };
  const close = () => setDialog(null);

  const confirm = wrap(async () => {
    if (!dialog) return;
    const { row, kind } = dialog;
    const res =
      kind === "return"
        ? await act(api.returnLoan(user.user_id, { borrowId: row.id, condition, scannedAccessionNo: scanned, remarks, damagedAmount: amount }), "Return recorded.")
        : await act(api.markLost(user.user_id, { borrowId: row.id, amount: amount === "" ? undefined : Number(amount) }), "Loan marked lost and a penalty was created.");
    if (res.ok) close();
  });

  const columns: Column<lib.LoanRow>[] = [
    { key: "student", label: "Student" },
    { key: "book", label: "Book" },
    { key: "accessionNo", label: "Copy" },
    { key: "due", label: "Due" },
    { key: "status", label: "Status", render: (l) => <Badge status={l.status} /> },
    {
      key: "actions",
      label: "",
      render: (l) => (
        <div className="row-actions">
          <button className="btn primary sm" onClick={() => open("return", l)}>Receive return</button>
          <button className="btn ghost sm" onClick={() => open("lost", l)}>Mark lost</button>
        </div>
      ),
    },
  ];
  const recentColumns: Column<lib.ReturnRow>[] = [
    { key: "student", label: "Student" },
    { key: "book", label: "Book" },
    { key: "accessionNo", label: "Copy" },
    { key: "returned", label: "Returned" },
    { key: "condition", label: "Condition", render: (r) => <Badge status={r.condition} /> },
    { key: "late", label: "Days late" },
  ];

  return (
    <>
      <span className="eyebrow">LIBRARIAN</span>
      <h1 className="page-title">Returns</h1>
      <div className="toolbar">
        <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student, book or copy ID…" />
      </div>
      <DataTable columns={columns} rows={rows} empty="No books are out on loan." />

      <h2 className="section-head">Recent returns</h2>
      <DataTable columns={recentColumns} rows={recent} empty="No returns yet." />

      {dialog?.kind === "return" && (
        <ConfirmDialog title="Confirm return" confirmLabel="Confirm return" busy={busy} confirmDisabled={!scanned.trim()} onConfirm={confirm} onClose={close}>
          <p><b>{dialog.row.student}</b> · “{dialog.row.book}” · copy {dialog.row.accessionNo}</p>
          {dialog.row.late > 0 && <p className="form-error">{dialog.row.late} day(s) overdue: a penalty of {dialog.row.fine.toFixed(2)} will be created.</p>}
          <label className="field"><span>Scan the copy (accession number)</span><input value={scanned} onChange={(e) => setScanned(e.target.value)} placeholder={dialog.row.accessionNo} /></label>
          <label className="field">
            <span>Condition</span>
            <select value={condition} onChange={(e) => setCondition(e.target.value as ConditionStatus)}>
              <option>Good</option>
              <option>Damaged</option>
            </select>
          </label>
          {condition === "Damaged" && (
            <label className="field"><span>Damage penalty (optional)</span><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          )}
          <label className="field"><span>Remarks</span><input value={remarks} onChange={(e) => setRemarks(e.target.value)} /></label>
          <p className="muted">{condition === "Good" ? "The copy becomes AVAILABLE and the next student in the queue is notified." : "The copy goes to MAINTENANCE until you put it back on the shelf."}</p>
        </ConfirmDialog>
      )}
      {dialog?.kind === "lost" && (
        <ConfirmDialog title="Mark this loan lost?" confirmLabel="Mark lost" danger busy={busy} onConfirm={confirm} onClose={close}>
          <p><b>{dialog.row.student}</b> · “{dialog.row.book}” · copy {dialog.row.accessionNo}</p>
          <label className="field"><span>Penalty amount (blank = book price)</span><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <p className="muted">The copy is removed from circulation. This cannot be undone.</p>
        </ConfirmDialog>
      )}
    </>
  );
}