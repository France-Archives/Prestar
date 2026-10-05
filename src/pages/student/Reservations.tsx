import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import Cover from "../../components/Cover";
import EmptyState from "../../components/EmptyState";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import * as api from "../../services/api";
import type { Reservation, ReservationStatus } from "../../types";
import { fmtDate, fmtDateTime } from "../../utils/dates";
import { indexBy } from "../../utils/lookup";
import { reservationStatus } from "../../utils/status";

type ReservationRow = Reservation & { shown: ReservationStatus };
const isActive = (s: ReservationStatus) => s === "Waiting" || s === "Ready";

export default function Reservations() {
  const { db, user, act } = useAuthedLibrary();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"active" | "closed">("active");
  const [cancelling, setCancelling] = useState<ReservationRow | null>(null);
  const [busy, wrap] = useBusy();

  const books = useMemo(() => indexBy(db.books, "book_id"), [db.books]);
  const mine = useMemo(
    (): ReservationRow[] =>
      db.reservations
        .filter((r) => r.user_id === user.user_id)
        .map((r) => ({ ...r, shown: reservationStatus(r) }))
        .sort((a, b) => b.reservation_date.localeCompare(a.reservation_date)),
    [db, user.user_id],
  );
  const active = mine.filter((r) => isActive(r.shown));
  const closed = mine.filter((r) => !isActive(r.shown));
  const list = tab === "active" ? active : closed;
  // a Waiting student who is not in good standing keeps the place but is skipped at promotion
  const skipped = api.checkEligibility(user.user_id, "promote").length > 0;

  const cancel = wrap(async () => {
    if (!cancelling) return;
    await act(api.cancelReservation(user.user_id, cancelling.reservation_id), "Reservation cancelled.");
    setCancelling(null);
  });

  return (
    <>
      <span className="eyebrow">LIBRARY</span>
      <h1 className="page-title">Reservations</h1>
      <div className="tabs">
        <button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>Active <b>{active.length}</b></button>
        <button className={tab === "closed" ? "active" : ""} onClick={() => setTab("closed")}>Closed</button>
      </div>

      {list.length === 0 ? (
        <EmptyState title="You are not on any waiting list" text="Reserve a book when all copies are out." action={<button className="btn primary sm" onClick={() => navigate("/student/books")}>Browse Books</button>} />
      ) : (
        <div className="req-list">
          {list.map((r) => {
            const b = books[r.book_id];
            return (
              <div className={`req ${r.shown === "Ready" ? "ready" : ""}`} key={r.reservation_id}>
                <div className="mini"><Cover book={b} /></div>
                <div className="req-info">
                  <h3>{b.title}</h3>
                  <p>{b.author}</p>
                  <div>
                    <Badge status={r.shown} />{" "}
                    <span className="muted">
                      {r.shown === "Waiting" && `Position ${api.queuePosition(r)} in the queue`}
                      {r.shown === "Ready" && `A copy is being held for you. Ready for pickup until ${fmtDateTime(r.expires_at)}. Show this at the counter.`}
                      {r.shown === "Fulfilled" && `Collected on ${fmtDate(r.closed_at)}`}
                      {r.shown === "Cancelled" && (r.remarks ? `Cancelled: ${r.remarks}` : "Cancelled")}
                      {r.shown === "Expired" && "You did not collect it in time. The copy was passed on."}
                    </span>
                  </div>
                  {r.shown === "Waiting" && skipped && <small className="reason">You keep your place, but you will be skipped until your account is in good standing.</small>}
                </div>
                {r.shown === "Fulfilled" && <Link className="btn ghost sm" to="/student/borrowing">View loan</Link>}
                {r.shown === "Expired" && <button className="btn ghost sm" onClick={() => navigate(`/student/books?q=${encodeURIComponent(b.title)}`)}>Reserve again</button>}
                {isActive(r.shown) && <button className="btn ghost sm" onClick={() => setCancelling(r)}>Cancel</button>}
              </div>
            );
          })}
        </div>
      )}

      {cancelling && (
        <ConfirmDialog title="Cancel this reservation?" confirmLabel="Cancel reservation" danger busy={busy} onConfirm={cancel} onClose={() => setCancelling(null)}>
          <p>“{books[cancelling.book_id].title}”: you will lose your place in the queue.</p>
        </ConfirmDialog>
      )}
    </>
  );
}