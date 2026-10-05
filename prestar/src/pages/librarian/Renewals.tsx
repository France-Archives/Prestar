import { useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import { useLive } from "../../hooks/useLive";
import * as api from "../../services/api";
import * as lib from "../../services/librarian";
import { CONFIG } from "../../utils/constants";

// Renewal rules are checked automatically (limit, overdue, restrictions, someone waiting).
// The librarian sees each loan's eligibility and can renew an eligible loan at the counter.
export default function Renewals() {
  const { act } = useAuthedLibrary();
  const rows = useLive(lib.getRenewalRows);
  const [tab, setTab] = useState<"eligible" | "blocked">("eligible");
  const [target, setTarget] = useState<lib.RenewalRow | null>(null);
  const [busy, wrap] = useBusy();

  const shown = rows.filter((r) => (tab === "eligible" ? r.eligible : !r.eligible));
  const confirm = wrap(async () => {
    if (!target) return;
    // TEMPORARY MOCK: renewLoan checks ownership by user id, so the counter renews on the student's behalf.
    // BACKEND REPLACEMENT: POST /librarian/loans/:id/renew (staff role), same eligibility rules on the server.
    const res = await act(api.renewLoan(target.userId, target.id), "Loan renewed.");
    if (res.ok) setTarget(null);
  });

  const columns: Column<lib.RenewalRow>[] = [
    { key: "student", label: "Student" },
    { key: "book", label: "Book" },
    { key: "due", label: "Due" },
    { key: "renewals", label: "Renewed", render: (r) => `${r.renewals} / ${CONFIG.RENEWAL_LIMIT}` },
    { key: "eligible", label: "Eligibility", render: (r) => (r.eligible ? <Badge status="Available">Eligible</Badge> : <Badge status="Rejected">Not eligible</Badge>) },
    { key: "reason", label: "Why", render: (r) => (r.eligible ? `New due date ${r.newDue}` : r.reason) },
    { key: "actions", label: "", render: (r) => (r.eligible ? <button className="btn primary sm" onClick={() => setTarget(r)}>Renew</button> : null) },
  ];

  return (
    <>
      <span className="eyebrow">LIBRARIAN</span>
      <h1 className="page-title">Renewals</h1>
      <div className="tabs">
        <button className={tab === "eligible" ? "active" : ""} onClick={() => setTab("eligible")}>Eligible <b>{rows.filter((r) => r.eligible).length}</b></button>
        <button className={tab === "blocked" ? "active" : ""} onClick={() => setTab("blocked")}>Not eligible <b>{rows.filter((r) => !r.eligible).length}</b></button>
      </div>
      <DataTable columns={columns} rows={shown} empty="No loans here." />
      {target && (
        <ConfirmDialog title="Renew this loan?" confirmLabel="Renew" busy={busy} onConfirm={confirm} onClose={() => setTarget(null)}>
          <p>{target.student} · “{target.book}”</p>
          <p className="muted">The due date moves from {target.due} to {target.newDue}.</p>
        </ConfirmDialog>
      )}
    </>
  );
}