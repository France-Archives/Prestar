import { useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import { useLive } from "../../hooks/useLive";
import * as api from "../../services/api";
import * as lib from "../../services/librarian";
import type { RequestStatus } from "../../types";

type Filter = "Pending" | "Approved" | "all";
type Action = { kind: "approve" | "reject"; row: lib.RequestRow };

// Step 1 of lending: review. Approving only HOLDS a copy. The loan is created later on the Issue page.
export default function LibrarianRequests() {
  const { user, act } = useAuthedLibrary();
  const rows = useLive(lib.getBorrowRequests);
  const [filter, setFilter] = useState<Filter>("Pending");
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [busy, wrap] = useBusy();

  const shown = rows.filter((r) => filter === "all" || r.status === (filter as RequestStatus));
  const count = (s: RequestStatus) => rows.filter((r) => r.status === s).length;

  const close = () => {
    setAction(null);
    setReason("");
  };
  const confirm = wrap(async () => {
    if (!action) return;
    const id = action.row.id;
    const res =
      action.kind === "approve"
        ? await act(api.approveRequest(user.user_id, id), "Request approved. The student can now pick up the book.")
        : await act(api.rejectRequest(user.user_id, id, reason), "Request rejected.");
    if (res.ok) close();
  });

  const columns: Column<lib.RequestRow>[] = [
    { key: "student", label: "Student", render: (r) => <>{r.student} <Badge status={r.standing} /></> },
    { key: "book", label: "Book" },
    { key: "date", label: "Request date" },
    { key: "free", label: "Free copies" },
    { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
    { key: "note", label: "Note" },
    {
      key: "actions",
      label: "",
      render: (r) =>
        r.status === "Pending" ? (
          <div className="row-actions">
            <button className="btn primary sm" onClick={() => setAction({ kind: "approve", row: r })}>Approve</button>
            <button className="btn ghost sm" onClick={() => setAction({ kind: "reject", row: r })}>Reject</button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <span className="eyebrow">LIBRARIAN</span>
      <h1 className="page-title">Borrow Requests</h1>
      <div className="tabs">
        <button className={filter === "Pending" ? "active" : ""} onClick={() => setFilter("Pending")}>Pending <b>{count("Pending")}</b></button>
        <button className={filter === "Approved" ? "active" : ""} onClick={() => setFilter("Approved")}>Approved <b>{count("Approved")}</b></button>
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All history</button>
      </div>
      <DataTable columns={columns} rows={shown} empty="No requests here." />

      {action?.kind === "approve" && (
        <ConfirmDialog title="Approve this request?" confirmLabel="Approve" busy={busy} onConfirm={confirm} onClose={close}>
          <p>{action.row.student} requested “{action.row.book}”.</p>
          <p className="muted">Approving holds a copy for pickup. The book counts as borrowed only after you issue it on the Issue page.</p>
        </ConfirmDialog>
      )}
      {action?.kind === "reject" && (
        <ConfirmDialog title="Reject this request" confirmLabel="Reject" danger busy={busy} confirmDisabled={!reason.trim()} onConfirm={confirm} onClose={close}>
          <p>{action.row.student} requested “{action.row.book}”.</p>
          <label className="field"><span>Reason (shown to the student)</span><input value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} /></label>
        </ConfirmDialog>
      )}
    </>
  );
}