import { useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import { useLive } from "../../hooks/useLive";
import * as api from "../../services/api";
import * as lib from "../../services/librarian";
import { fmtDate } from "../../utils/dates";

// Step 2 of lending: the physical handover. This is the ONLY place a loan (BORROWED) is created.
export default function Issue() {
  const { user, act } = useAuthedLibrary();
  const rows = useLive(lib.getIssueQueue);
  const [row, setRow] = useState<lib.IssueRow | null>(null);
  const [accessionNo, setAccessionNo] = useState("");
  const [studentOk, setStudentOk] = useState(false);
  const [copyOk, setCopyOk] = useState(false);
  const [busy, wrap] = useBusy();

  const open = (r: lib.IssueRow) => {
    setRow(r);
    // Left empty on purpose: the librarian must scan or type the copy in hand. The list below only suggests copies.
    setAccessionNo("");
    setStudentOk(false);
    setCopyOk(false);
  };
  const close = () => setRow(null);

  const confirm = wrap(async () => {
    if (!row) return;
    const payload = row.kind === "request" ? { requestId: row.sourceId, accessionNo } : { reservationId: row.sourceId, accessionNo };
    const res = await act(api.issueLoan(user.user_id, payload), "Book issued. The loan is now BORROWED.");
    if (res.ok) close();
  });

  const columns: Column<lib.IssueRow>[] = [
    { key: "student", label: "Student" },
    { key: "standing", label: "Standing", render: (r) => <Badge status={r.standing} /> },
    { key: "book", label: "Book" },
    { key: "kind", label: "From", render: (r) => (r.kind === "request" ? "Approved request" : "Ready reservation") },
    { key: "until", label: "Pick up by" },
    { key: "copies", label: "Copies on shelf", render: (r) => r.copies.length },
    { key: "actions", label: "", render: (r) => <button className="btn primary sm" onClick={() => open(r)}>Issue</button> },
  ];

  return (
    <>
      <span className="eyebrow">LIBRARIAN</span>
      <h1 className="page-title">Issue / Handover</h1>
      <p className="muted">Approved requests and ready reservations waiting for pickup. Approved is not borrowed: the loan starts only when you confirm the handover here.</p>
      <DataTable columns={columns} rows={rows} empty="Nobody is waiting for pickup." />

      {row && (
        <ConfirmDialog
          title="Confirm handover"
          confirmLabel="Confirm issue"
          busy={busy}
          confirmDisabled={!studentOk || !copyOk || !accessionNo.trim() || row.blockers.length > 0}
          onConfirm={confirm}
          onClose={close}
        >
          <p><b>{row.student}</b> · “{row.book}”</p>
          {row.blockers.length > 0 && <p className="form-error">{row.blockers[0]}</p>}
          <label className="check"><input type="checkbox" checked={studentOk} onChange={(e) => setStudentOk(e.target.checked)} /> I checked the student’s ID against {row.student}</label>
          <label className="field">
            <span>Physical copy (accession number)</span>
            <input list="issue-copies" value={accessionNo} onChange={(e) => setAccessionNo(e.target.value)} placeholder="Scan or type the accession number" />
            <datalist id="issue-copies">
              {row.copies.map((c) => <option key={c.copyId} value={c.accessionNo} />)}
            </datalist>
          </label>
          {row.copies.length === 0 && <p className="form-error">No copy is on the shelf for this book.</p>}
          <label className="check"><input type="checkbox" checked={copyOk} onChange={(e) => setCopyOk(e.target.checked)} /> The copy in my hand matches this accession number and is in good condition</label>
          <p className="muted">Due date: <b>{fmtDate(row.dueDate)}</b> (set by the library rules)</p>
        </ConfirmDialog>
      )}
    </>
  );
}