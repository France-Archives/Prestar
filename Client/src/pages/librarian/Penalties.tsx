import { useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import { useLive } from "../../hooks/useLive";
import * as api from "../../services/api";
import * as lib from "../../services/librarian";
import type { SuspensionReason } from "../../types";

type Dialog = { kind: "pay" | "waive"; row: lib.PenaltyRow } | { kind: "suspend" } | { kind: "lift"; row: lib.SuspensionRow } | null;
const REASONS: SuspensionReason[] = ["Violation", "Lost Book", "Damaged Book", "Other"];

// Penalties are paid in cash at the counter (no online payment). Suspensions block new borrowing only.
export default function Penalties() {
  const { user, act } = useAuthedLibrary();
  const penalties = useLive(lib.getPenaltyRows);
  const suspensions = useLive(lib.getSuspensionRows);
  const students = useLive(lib.getStudentOptions);
  const [tab, setTab] = useState<"penalties" | "suspensions">("penalties");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState(""); // receipt number, waive reason or lift remarks
  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState<SuspensionReason>("Violation");
  const [endDate, setEndDate] = useState("");
  const [busy, wrap] = useBusy();

  const open = (d: Dialog) => {
    setDialog(d);
    setText("");
    setStudentId("");
    setReason("Violation");
    setEndDate("");
  };
  const close = () => setDialog(null);

  const confirm = wrap(async () => {
    if (!dialog) return;
    let res;
    if (dialog.kind === "pay") res = await act(api.payPenalty(user.user_id, dialog.row.id, text), "Payment recorded.");
    else if (dialog.kind === "waive") res = await act(api.waivePenalty(user.user_id, dialog.row.id, text), "Penalty waived.");
    else if (dialog.kind === "lift") res = await act(api.liftSuspension(user.user_id, dialog.row.id, text), "Suspension lifted.");
    else res = await act(api.createSuspension(user.user_id, { userId: Number(studentId), reasonType: reason, reasonDetails: text, endDate }), "Student suspended.");
    if (res.ok) close();
  });

  const penaltyColumns: Column<lib.PenaltyRow>[] = [
    { key: "student", label: "Student" },
    { key: "book", label: "Book" },
    { key: "type", label: "Type" },
    { key: "amount", label: "Amount" },
    { key: "status", label: "Status", render: (p) => <Badge status={p.status} /> },
    { key: "created", label: "Created" },
    { key: "receipt", label: "Receipt" },
    {
      key: "actions",
      label: "",
      render: (p) =>
        p.status === "Unpaid" ? (
          <div className="row-actions">
            <button className="btn primary sm" onClick={() => open({ kind: "pay", row: p })}>Record payment</button>
            <button className="btn ghost sm" onClick={() => open({ kind: "waive", row: p })}>Waive</button>
          </div>
        ) : null,
    },
  ];
  const suspensionColumns: Column<lib.SuspensionRow>[] = [
    { key: "student", label: "Student" },
    { key: "reason", label: "Reason" },
    { key: "details", label: "Details" },
    { key: "start", label: "From" },
    { key: "end", label: "Until" },
    { key: "status", label: "Status", render: (s) => <Badge status={s.status} /> },
    { key: "actions", label: "", render: (s) => (s.status === "Active" ? <button className="btn ghost sm" onClick={() => open({ kind: "lift", row: s })}>Lift</button> : null) },
  ];

  const titles = { pay: "Record payment", waive: "Waive penalty", lift: "Lift suspension", suspend: "Suspend a student" } as const;
  const needsText = dialog?.kind !== "lift";

  return (
    <>
      <span className="eyebrow">LIBRARIAN</span>
      <h1 className="page-title">Penalties &amp; Suspensions</h1>
      <div className="tabs">
        <button className={tab === "penalties" ? "active" : ""} onClick={() => setTab("penalties")}>Penalties <b>{penalties.filter((p) => p.status === "Unpaid").length}</b></button>
        <button className={tab === "suspensions" ? "active" : ""} onClick={() => setTab("suspensions")}>Suspensions <b>{suspensions.filter((s) => s.status === "Active").length}</b></button>
      </div>
      {tab === "suspensions" && (
        <div className="toolbar"><button className="btn primary sm" onClick={() => open({ kind: "suspend" })}>Suspend a student</button></div>
      )}
      {tab === "penalties" ? (
        <DataTable columns={penaltyColumns} rows={penalties} empty="No penalties." />
      ) : (
        <DataTable columns={suspensionColumns} rows={suspensions} empty="No suspensions." />
      )}

      {dialog && (
        <ConfirmDialog
          title={titles[dialog.kind]}
          confirmLabel="Confirm"
          danger={dialog.kind === "suspend"}
          busy={busy}
          confirmDisabled={(needsText && !text.trim()) || (dialog.kind === "suspend" && !studentId)}
          onConfirm={confirm}
          onClose={close}
        >
          {dialog.kind === "suspend" && (
            <>
              <label className="field">
                <span>Student</span>
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                  <option value="">Choose…</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <div className="row">
                <label className="field">
                  <span>Reason</span>
                  <select value={reason} onChange={(e) => setReason(e.target.value as SuspensionReason)}>
                    {REASONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </label>
                <label className="field"><span>Ends on (optional)</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
              </div>
            </>
          )}
          {(dialog.kind === "pay" || dialog.kind === "waive") && <p>{dialog.row.student} · {dialog.row.type} · {dialog.row.amount}</p>}
          <label className="field">
            <span>{dialog.kind === "pay" ? "Receipt number" : dialog.kind === "waive" ? "Reason for waiving" : dialog.kind === "lift" ? "Remarks (optional)" : "Details"}</span>
            <input value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        </ConfirmDialog>
      )}
    </>
  );
}