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

const GHOST_BTN =
  "btn ghost sm inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-5 font-sans text-[12.5px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] sm:w-auto";

const PRIMARY_BTN =
  "btn primary sm inline-flex h-10 items-center justify-center rounded-[10px] bg-[#0B3D32] px-5 font-sans text-[12.5px] font-medium text-white shadow-[0_6px_14px_rgba(11,61,50,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#07352C] active:scale-[0.98]";

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
    <div className="mx-auto w-full font-sans text-[#1F2A27]">
      {/* Heading */}
      <header className="relative overflow-hidden rounded-[22px] border border-[#D9DDD7] bg-[#FBFAF5] px-5 py-8 shadow-[0_4px_14px_rgba(11,61,50,0.05)] sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#DCE5D7]/80 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-[#D9C19A]/40 blur-3xl" />
        <div className="relative">
          <span className="eyebrow mb-2 inline-flex items-center gap-2 font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">
            <span className="h-px w-8 bg-[#B98A4A]" />
            LIBRARY
          </span>
          <h1 className="page-title font-serif text-[clamp(32px,5.5vw,52px)] font-medium leading-[1.08] tracking-[-0.01em] text-[#0B3D32]">
            Reservations
          </h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs mt-6 flex gap-2 overflow-x-auto border-b border-[#D9DDD7]">
        <button
          className={`${tab === "active" ? "active" : ""} -mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-sans text-[13px] font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] ${
            tab === "active" ? "border-[#0B3D32] text-[#0B3D32]" : "border-transparent text-[#6B756F] hover:text-[#0B3D32]"
          }`}
          onClick={() => setTab("active")}
        >
          Active
          <b
            className={`grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 font-sans text-[10px] font-bold leading-none ${
              tab === "active" ? "bg-[#0B3D32] text-white" : "bg-[#DCE5D7] text-[#0B3D32]"
            }`}
          >
            {active.length}
          </b>
        </button>
        <button
          className={`${tab === "closed" ? "active" : ""} -mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-sans text-[13px] font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] ${
            tab === "closed" ? "border-[#0B3D32] text-[#0B3D32]" : "border-transparent text-[#6B756F] hover:text-[#0B3D32]"
          }`}
          onClick={() => setTab("closed")}
        >
          Closed
        </button>
      </div>

      {/* List */}
      <div className="mt-6">
        {list.length === 0 ? (
          <EmptyState
            title="You are not on any waiting list"
            text="Reserve a book when all copies are out."
            action={
              <button className={PRIMARY_BTN} onClick={() => navigate("/student/books")}>
                Browse Books
              </button>
            }
          />
        ) : (
          <div className="req-list flex flex-col gap-4">
            {list.map((r) => {
              const b = books[r.book_id];
              const ready = r.shown === "Ready";
              const waiting = r.shown === "Waiting";
              return (
                <div
                  className={`req ${ready ? "ready" : ""} relative flex flex-col gap-4 overflow-hidden rounded-[16px] border p-4 shadow-[0_4px_14px_rgba(11,61,50,0.05)] transition-all duration-300 ease-[cubic-bezier(.22,.8,.3,1)] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(11,61,50,0.1)] sm:flex-row sm:items-center sm:gap-6 sm:p-5 ${
                    ready ? "border-[#6F9B78] bg-[#DCE5D7]/50" : "border-[#D9DDD7] bg-[#FBFAF5]"
                  }`}
                  key={r.reservation_id}
                >
                  {(ready || waiting) && (
                    <span className={`absolute inset-y-0 left-0 w-1 ${ready ? "bg-[#0B3D32]" : "bg-[#6F9B78]"}`} aria-hidden="true" />
                  )}

                  <div className="mini w-[84px] shrink-0 overflow-hidden rounded-[8px] shadow-[0_8px_18px_rgba(7,53,44,0.2)] sm:w-[96px]">
                    <Cover book={b} />
                  </div>

                  <div className="req-info flex min-w-0 flex-1 flex-col gap-1.5">
                    <h3 className="font-serif text-[20px] font-medium leading-snug text-[#0B3D32]">{b.title}</h3>
                    <p className="font-sans text-[13px] text-[#6B756F]">{b.author}</p>
                    <p className="font-sans text-[11.5px] text-[#6B756F]">Reserved {fmtDate(r.reservation_date)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <Badge status={r.shown} />
                      <span className="muted font-sans text-[12px] leading-snug text-[#6B756F]">
                        {r.shown === "Waiting" && `Position ${api.queuePosition(r)} in the queue`}
                        {r.shown === "Ready" && `A copy is being held for you. Ready for pickup until ${fmtDateTime(r.expires_at)}. Show this at the counter.`}
                        {r.shown === "Fulfilled" && `Collected on ${fmtDate(r.closed_at)}`}
                        {r.shown === "Cancelled" && (r.remarks ? `Cancelled: ${r.remarks}` : "Cancelled")}
                        {r.shown === "Expired" && "You did not collect it in time. The copy was passed on."}
                      </span>
                    </div>
                    {r.shown === "Waiting" && skipped && (
                      <small className="reason block rounded-[10px] border border-[#E6C7BD] bg-[#F1DDD6] px-3 py-2 font-sans text-[11.5px] text-[#8A3B35]">
                        You keep your place, but you will be skipped until your account is in good standing.
                      </small>
                    )}
                  </div>

                  {waiting && (
                    <div className="flex shrink-0 flex-row items-center justify-center gap-3 rounded-[14px] border border-[#6F9B78] bg-[#F5F3EA] px-5 py-3 sm:min-w-[96px] sm:flex-col sm:gap-0">
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-[#6B756F]">Queue</span>
                      <b className="font-serif text-[38px] font-medium leading-none text-[#0B3D32] sm:mt-1">{api.queuePosition(r)}</b>
                    </div>
                  )}
                  {ready && (
                    <div className="flex shrink-0 flex-row items-center justify-center gap-3 rounded-[14px] bg-[#0B3D32] px-5 py-3 sm:min-w-[96px] sm:flex-col sm:gap-0">
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-[#D9C19A]">Ready</span>
                      <b className="font-serif text-[20px] font-medium leading-tight text-white sm:mt-1">Pickup</b>
                    </div>
                  )}

                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    {r.shown === "Fulfilled" && (
                      <Link className={GHOST_BTN} to="/student/borrowing">
                        View loan
                      </Link>
                    )}
                    {r.shown === "Expired" && (
                      <button className={GHOST_BTN} onClick={() => navigate(`/student/books?q=${encodeURIComponent(b.title)}`)}>
                        Reserve again
                      </button>
                    )}
                    {isActive(r.shown) && (
                      <button className={GHOST_BTN} onClick={() => setCancelling(r)}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cancelling && (
        <ConfirmDialog title="Cancel this reservation?" confirmLabel="Cancel reservation" danger busy={busy} onConfirm={cancel} onClose={() => setCancelling(null)}>
          <p>“{books[cancelling.book_id].title}”: you will lose your place in the queue.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}