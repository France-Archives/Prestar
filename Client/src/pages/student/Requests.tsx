import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import Cover from "../../components/Cover";
import EmptyState from "../../components/EmptyState";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import * as api from "../../services/api";
import type { BorrowRequest, RequestStatus } from "../../types";
import { fmtDate, fmtDateTime } from "../../utils/dates";
import { indexBy } from "../../utils/lookup";
import { requestStatus } from "../../utils/status";

type TabKey = "all" | "pending" | "approved" | "closed";
const TABS: Record<TabKey, (s: RequestStatus) => boolean> = {
  all: () => true,
  pending: (s) => s === "Pending",
  approved: (s) => s === "Approved",
  closed: (s) => ["Issued", "Rejected", "Cancelled", "Expired"].includes(s),
};
const TAB_KEYS: TabKey[] = ["all", "pending", "approved", "closed"];

type RequestRow = BorrowRequest & { shown: RequestStatus };

const GHOST_BTN =
  "btn ghost sm inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-5 font-sans text-[12.5px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] sm:w-auto";

const PRIMARY_BTN =
  "btn primary sm inline-flex h-10 items-center justify-center rounded-[10px] bg-[#0B3D32] px-5 font-sans text-[12.5px] font-medium text-white shadow-[0_6px_14px_rgba(11,61,50,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#07352C] active:scale-[0.98]";

export default function Requests() {
  const { db, user, act } = useAuthedLibrary();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("all");
  const [cancelling, setCancelling] = useState<RequestRow | null>(null);
  const [busy, wrap] = useBusy();

  const books = useMemo(() => indexBy(db.books, "book_id"), [db.books]);
  const mine = useMemo(
    (): RequestRow[] =>
      db.borrow_requests
        .filter((r) => r.user_id === user.user_id)
        .map((r) => ({ ...r, shown: requestStatus(r) }))
        .sort((a, b) => b.request_date.localeCompare(a.request_date)),
    [db, user.user_id],
  );
  const list = mine.filter((r) => TABS[tab](r.shown));
  const count = (t: TabKey) => mine.filter((r) => TABS[t](r.shown)).length;

  const cancel = wrap(async () => {
    if (!cancelling) return;
    await act(api.cancelRequest(user.user_id, cancelling.request_id), "Request cancelled.");
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
            My Requests
          </h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs mt-6 flex gap-2 overflow-x-auto border-b border-[#D9DDD7] pb-0">
        {TAB_KEYS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              className={`${active ? "active" : ""} -mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-sans text-[13px] font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] ${
                active
                  ? "border-[#0B3D32] text-[#0B3D32]"
                  : "border-transparent text-[#6B756F] hover:text-[#0B3D32]"
              }`}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
              {t !== "all" && (
                <b
                  className={`grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 font-sans text-[10px] font-bold leading-none ${
                    active ? "bg-[#0B3D32] text-white" : "bg-[#DCE5D7] text-[#0B3D32]"
                  }`}
                >
                  {count(t)}
                </b>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="mt-6">
        {list.length === 0 ? (
          <EmptyState
            title="You have no requests"
            text="Request a book to see it here."
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
              const pending = r.shown === "Pending";
              const approved = r.shown === "Approved";
              return (
                <div
                  className={`req relative flex flex-col gap-4 overflow-hidden rounded-[16px] border bg-[#FBFAF5] p-4 shadow-[0_4px_14px_rgba(11,61,50,0.05)] transition-all duration-300 ease-[cubic-bezier(.22,.8,.3,1)] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(11,61,50,0.1)] sm:flex-row sm:items-center sm:gap-6 sm:p-5 ${
                    pending
                      ? "border-[#6F9B78]"
                      : approved
                        ? "border-[#0B3D32]/40"
                        : "border-[#D9DDD7]"
                  }`}
                  key={r.request_id}
                >
                  {(pending || approved) && (
                    <span
                      className={`absolute inset-y-0 left-0 w-1 ${pending ? "bg-[#6F9B78]" : "bg-[#0B3D32]"}`}
                      aria-hidden="true"
                    />
                  )}

                  <div className="mini w-[72px] shrink-0 overflow-hidden rounded-[8px] shadow-[0_8px_18px_rgba(7,53,44,0.2)] sm:w-[84px]">
                    <Cover book={b} />
                  </div>

                  <div className="req-info flex min-w-0 flex-1 flex-col gap-1.5">
                    <h3 className="font-serif text-[20px] font-medium leading-snug text-[#0B3D32]">{b.title}</h3>
                    <p className="font-sans text-[13px] text-[#6B756F]">{b.author}</p>
                    <p className="font-sans text-[11.5px] text-[#6B756F]">Requested {fmtDate(r.request_date)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <Badge status={r.shown} />
                      <span className="muted font-sans text-[12px] leading-snug text-[#6B756F]">
                        {r.shown === "Pending" && `Requested ${fmtDate(r.request_date)}`}
                        {r.shown === "Approved" && `Pick up by ${fmtDateTime(r.pickup_deadline)}`}
                        {r.shown === "Issued" && "Handed over by the library"}
                        {r.shown === "Rejected" && `Reason: ${r.remarks ?? "—"}`}
                        {r.shown === "Cancelled" && (r.remarks ?? `Cancelled ${fmtDate(r.request_date)}`)}
                        {r.shown === "Expired" && "Not collected before the deadline"}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    {r.shown === "Issued" && (
                      <Link className={GHOST_BTN} to="/student/borrowing">
                        View loan
                      </Link>
                    )}
                    {r.shown === "Expired" && (
                      <button className={GHOST_BTN} onClick={() => navigate(`/student/books?q=${encodeURIComponent(b.title)}`)}>
                        Request again
                      </button>
                    )}
                    {(r.shown === "Pending" || r.shown === "Approved") && (
                      <button className={GHOST_BTN} onClick={() => setCancelling(r)}>
                        Cancel request
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
        <ConfirmDialog title="Cancel this request?" confirmLabel="Cancel request" danger busy={busy} onConfirm={cancel} onClose={() => setCancelling(null)}>
          <p>“{books[cancelling.book_id].title}”: any copy held for you will be released.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}