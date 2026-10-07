import { useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import { useLive } from "../../hooks/useLive";
import * as api from "../../services/api";
import * as lib from "../../services/librarian";

// Reservation queue. Ready reservations are collected on the Issue page.
export default function LibrarianReservations() {
  const { user, act } = useAuthedLibrary();
  const rows = useLive(lib.getReservationRows);
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [target, setTarget] = useState<lib.ReservationRow | null>(null);
  const [remark, setRemark] = useState("");
  const [busy, wrap] = useBusy();

  const shown = rows.filter((r) => (tab === "open" ? r.open : !r.open));
  const close = () => {
    setTarget(null);
    setRemark("");
  };
  const cancel = wrap(async () => {
    if (!target) return;
    const res = await act(api.cancelReservation(user.user_id, target.id, remark), "Reservation cancelled.");
    if (res.ok) close();
  });

  const columns: Column<lib.ReservationRow>[] = [
    { key: "student", label: "Student" },
    { key: "book", label: "Book" },
    { key: "date", label: "Reserved" },
    { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
    { key: "info", label: "Queue / details" },
    { key: "actions", label: "", render: (r) => (r.open ? <button className="btn ghost sm" onClick={() => setTarget(r)}>Cancel</button> : null) },
  ];

  return (
    <>
      <span className="eyebrow">LIBRARIAN</span>
      <h1 className="page-title">Reservations</h1>
      <div className="tabs">
        <button className={tab === "open" ? "active" : ""} onClick={() => setTab("open")}>Open <b>{rows.filter((r) => r.open).length}</b></button>
        <button className={tab === "closed" ? "active" : ""} onClick={() => setTab("closed")}>Closed</button>
      </div>
      <DataTable columns={columns} rows={shown} empty="No reservations here." />
      {target && (
        <ConfirmDialog title="Cancel this reservation?" confirmLabel="Cancel reservation" danger busy={busy} confirmDisabled={!remark.trim()} onConfirm={cancel} onClose={close}>
          <p>{target.student} · “{target.book}”</p>
          <label className="field"><span>Reason</span><input value={remark} onChange={(e) => setRemark(e.target.value)} /></label>
        </ConfirmDialog>
      )}
    </>
  );
}