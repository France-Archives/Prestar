import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import Cover from "../../components/Cover";
import EmptyState from "../../components/EmptyState";
import Pager from "../../components/Pager";
import RenewDialog from "../../components/RenewDialog";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { usePaged } from "../../hooks/usePaged";
import * as api from "../../services/api";
import type { Book, BorrowedBook, Penalty } from "../../types";
import { CONFIG } from "../../utils/constants";
import { daysUntil, fmtDate } from "../../utils/dates";
import { indexBy } from "../../utils/lookup";
import { loanStatus } from "../../utils/status";

type PenaltiesPanelProps = { penalties: Penalty[]; books: Record<string, Book>; loans: Record<string, BorrowedBook> };

function PenaltiesPanel({ penalties, books, loans }: PenaltiesPanelProps) {
  return (
    <div className="panel section">
      <h2>Penalties</h2>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Type</th><th>Book</th><th>Amount</th><th>Status</th><th>Receipt</th></tr>
          </thead>
          <tbody>
            {penalties.map((p) => (
              <tr key={p.penalty_id}>
                <td>{p.penalty_type}</td>
                <td>{books[loans[p.borrow_id].book_id].title}</td>
                <td>{p.amount.toFixed(2)}</td>
                <td><Badge status={p.status} /></td>
                <td>{p.receipt_no ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">Pay penalties in cash at the library counter. There is no online payment.</p>
    </div>
  );
}

export default function Borrowing() {
  const { db, user } = useAuthedLibrary();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"current" | "history">("current");
  const [renewing, setRenewing] = useState<BorrowedBook | null>(null);
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const uid = user.user_id;

  const books = useMemo(() => indexBy(db.books, "book_id"), [db.books]);
  const copies = useMemo(() => indexBy(db.book_copies, "copy_id"), [db.book_copies]);
  const allLoans = useMemo(() => indexBy(db.borrowed_books, "borrow_id"), [db.borrowed_books]);
  const mine = useMemo(() => db.borrowed_books.filter((l) => l.user_id === uid), [db, uid]);
  const penalties = useMemo(() => db.penalties.filter((p) => p.user_id === uid), [db, uid]);

  const current = mine
    .filter((l) => l.status === "Borrowed")
    .sort((a, b) => Number(api.isOverdue(b)) - Number(api.isOverdue(a)) || a.due_date.localeCompare(b.due_date));

  const history = useMemo(
    () =>
      mine
        .filter((l) => l.status !== "Borrowed")
        .map((l) => {
          const ret = db.returned_books.find((r) => r.borrow_id === l.borrow_id);
          return { ...l, ret, closedAt: ret?.return_date ?? l.lost_at ?? "" };
        })
        .filter((l) => {
          const day = l.closedAt.slice(0, 10);
          return (status === "all" || l.status === status) && (!from || day >= from) && (!to || day <= to);
        })
        .sort((a, b) => b.closedAt.localeCompare(a.closedAt)),
    [db, mine, status, from, to],
  );
  const pg = usePaged(history, 10);

  const hasUnpaid = penalties.some((p) => p.status === "Unpaid");

  return (
    <>
      <span className="eyebrow">WITH YOU NOW</span>
      <h1 className="page-title">My Borrowing</h1>
      {hasUnpaid && <PenaltiesPanel penalties={penalties} books={books} loans={allLoans} />}

      <div className="tabs">
        <button className={tab === "current" ? "active" : ""} onClick={() => setTab("current")}>Current <b>{current.length}</b></button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History</button>
      </div>

      {tab === "current" &&
        (current.length === 0 ? (
          <EmptyState title="You are not borrowing any books" text="Find a book to borrow from the library." action={<button className="btn primary sm" onClick={() => navigate("/student/books")}>Browse Books</button>} />
        ) : (
          <div className="req-list">
            {current.map((l) => {
              const b = books[l.book_id];
              const rs = api.renewalState(l);
              const left = daysUntil(l.due_date);
              return (
                <div className="req" key={l.borrow_id}>
                  <div className="mini"><Cover book={b} /></div>
                  <div className="req-info">
                    <h3>{b.title}</h3>
                    <p>{b.author} · Copy {copies[l.copy_id].accession_no}</p>
                    <div>
                      <Badge status={loanStatus(l)} />{" "}
                      <span className="muted">
                        Borrowed {fmtDate(l.borrow_date)} · Due {fmtDate(l.due_date)} ({left >= 0 ? `${left} days left` : `${-left} days late`}) · Renewals {l.renewal_count} of {CONFIG.RENEWAL_LIMIT}
                      </span>
                    </div>
                    {!rs.ok && <small className="reason">{rs.reason}</small>}
                  </div>
                  <button className="btn ghost sm" disabled={!rs.ok} onClick={() => setRenewing(l)}>Renew</button>
                </div>
              );
            })}
            <p className="muted">Returns are confirmed by a librarian at the library counter. Bring the book to the library.</p>
          </div>
        ))}

      {tab === "history" && (
        <>
          <div className="toolbar">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="all">All</option>
              <option value="Returned">Returned</option>
              <option value="Lost">Lost</option>
            </select>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          </div>
          {history.length === 0 ? (
            <EmptyState title="No past loans" text="Returned and lost books appear here." />
          ) : (
            <>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>Book</th><th>Copy</th><th>Borrowed</th><th>Closed</th><th>Condition</th><th>Days overdue</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {pg.slice.map((l) => (
                      <tr key={l.borrow_id}>
                        <td>{books[l.book_id].title}</td>
                        <td>{copies[l.copy_id].accession_no}</td>
                        <td>{fmtDate(l.borrow_date)}</td>
                        <td>{fmtDate(l.closedAt)}</td>
                        <td>{l.ret?.condition_status ?? "—"}</td>
                        <td>{l.ret?.days_overdue ?? "—"}</td>
                        <td><Badge status={l.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={pg.page} pages={pg.pages} onChange={pg.setPage} />
            </>
          )}
          {!hasUnpaid && penalties.length > 0 && <PenaltiesPanel penalties={penalties} books={books} loans={allLoans} />}
        </>
      )}

      {renewing && <RenewDialog loan={renewing} book={books[renewing.book_id]} onClose={() => setRenewing(null)} />}
    </>
  );
}