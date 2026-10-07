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
    <>
      <span className="eyebrow">LIBRARY</span>
      <h1 className="page-title">My Requests</h1>
      <div className="tabs">
        {TAB_KEYS.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)} {t !== "all" && <b>{count(t)}</b>}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title="You have no requests" text="Request a book to see it here." action={<button className="btn primary sm" onClick={() => navigate("/student/books")}>Browse Books</button>} />
      ) : (
        <div className="req-list">
          {list.map((r) => {
            const b = books[r.book_id];
            return (
              <div className="req" key={r.request_id}>
                <div className="mini"><Cover book={b} /></div>
                <div className="req-info">
                  <h3>{b.title}</h3>
                  <p>{b.author}</p>
                  <div>
                    <Badge status={r.shown} />{" "}
                    <span className="muted">
                      {r.shown === "Pending" && `Requested ${fmtDate(r.request_date)}`}
                      {r.shown === "Approved" && `Pick up by ${fmtDateTime(r.pickup_deadline)}`}
                      {r.shown === "Issued" && "Handed over by the library"}
                      {r.shown === "Rejected" && `Reason: ${r.remarks ?? "—"}`}
                      {r.shown === "Cancelled" && (r.remarks ?? `Cancelled ${fmtDate(r.request_date)}`)}
                      {r.shown === "Expired" && "Not collected before the deadline"}
                    </span>
                  </div>
                </div>
                {r.shown === "Issued" && <Link className="btn ghost sm" to="/student/borrowing">View loan</Link>}
                {r.shown === "Expired" && <button className="btn ghost sm" onClick={() => navigate(`/student/books?q=${encodeURIComponent(b.title)}`)}>Request again</button>}
                {(r.shown === "Pending" || r.shown === "Approved") && <button className="btn ghost sm" onClick={() => setCancelling(r)}>Cancel request</button>}
              </div>
            );
          })}
        </div>
      )}

      {cancelling && (
        <ConfirmDialog title="Cancel this request?" confirmLabel="Cancel request" danger busy={busy} onConfirm={cancel} onClose={() => setCancelling(null)}>
          <p>“{books[cancelling.book_id].title}”: any copy held for you will be released.</p>
        </ConfirmDialog>
      )}
    </>
  );
}