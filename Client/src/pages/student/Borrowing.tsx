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

const GHOST_BTN =
  "btn ghost sm inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-5 font-sans text-[12.5px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-[#D9DDD7] disabled:hover:bg-[#FBFAF5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] sm:w-auto";

const PRIMARY_BTN =
  "btn primary sm inline-flex h-10 items-center justify-center rounded-[10px] bg-[#0B3D32] px-5 font-sans text-[12.5px] font-medium text-white shadow-[0_6px_14px_rgba(11,61,50,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#07352C] active:scale-[0.98]";

const TH_CLS =
  "whitespace-nowrap border-b border-[#D9DDD7] bg-[#F5F3EA] px-4 py-3 text-left font-sans text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#6B756F]";
const TD_CLS = "border-b border-[#D9DDD7] px-4 py-3 font-sans text-[13px] text-[#1F2A27]";

type PenaltiesPanelProps = { penalties: Penalty[]; books: Record<string, Book>; loans: Record<string, BorrowedBook> };

function PenaltiesPanel({ penalties, books, loans }: PenaltiesPanelProps) {
  return (
    <div className="panel section mt-6 flex flex-col gap-4 rounded-[16px] border border-[#E6C7BD] bg-[#FBFAF5] p-5 shadow-[0_4px_14px_rgba(11,61,50,0.05)] sm:p-6">
      <div>
        <span className="eyebrow block font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">Account</span>
        <h2 className="font-serif text-[22px] font-medium leading-tight text-[#0B3D32]">Penalties</h2>
      </div>
      <div className="tbl-wrap overflow-x-auto rounded-[12px] border border-[#D9DDD7]">
        <table className="tbl w-full border-collapse">
          <thead>
            <tr>
              <th className={TH_CLS}>Type</th>
              <th className={TH_CLS}>Book</th>
              <th className={TH_CLS}>Amount</th>
              <th className={TH_CLS}>Status</th>
              <th className={TH_CLS}>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {penalties.map((p) => (
              <tr key={p.penalty_id} className="transition-colors duration-150 hover:bg-[#F5F3EA]">
                <td className={TD_CLS}>{p.penalty_type}</td>
                <td className={`${TD_CLS} font-serif text-[14px] text-[#0B3D32]`}>{books[loans[p.borrow_id].book_id].title}</td>
                <td className={TD_CLS}>{p.amount.toFixed(2)}</td>
                <td className={TD_CLS}>
                  <Badge status={p.status} />
                </td>
                <td className={TD_CLS}>{p.receipt_no ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted font-sans text-[12px] text-[#6B756F]">Pay penalties in cash at the library counter. There is no online payment.</p>
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

  const controlCls =
    "input h-11 rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-3.5 font-sans text-[13px] text-[#1F2A27] shadow-none transition-all duration-200 hover:border-[#6F9B78] focus:border-[#6F9B78] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6F9B78]/40";

  return (
    <div className="mx-auto w-full font-sans text-[#1F2A27]">
      {/* Heading */}
      <header className="relative overflow-hidden rounded-[22px] border border-[#D9DDD7] bg-[#FBFAF5] px-5 py-8 shadow-[0_4px_14px_rgba(11,61,50,0.05)] sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#DCE5D7]/80 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-[#D9C19A]/40 blur-3xl" />
        <div className="relative">
          <span className="eyebrow mb-2 inline-flex items-center gap-2 font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">
            <span className="h-px w-8 bg-[#B98A4A]" />
            WITH YOU NOW
          </span>
          <h1 className="page-title font-serif text-[clamp(32px,5.5vw,52px)] font-medium leading-[1.08] tracking-[-0.01em] text-[#0B3D32]">
            My Borrowing
          </h1>
        </div>
      </header>

      {hasUnpaid && <PenaltiesPanel penalties={penalties} books={books} loans={allLoans} />}

      {/* Tabs */}
      <div className="tabs mt-6 flex gap-2 overflow-x-auto border-b border-[#D9DDD7]">
        <button
          className={`${tab === "current" ? "active" : ""} -mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-sans text-[13px] font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] ${
            tab === "current" ? "border-[#0B3D32] text-[#0B3D32]" : "border-transparent text-[#6B756F] hover:text-[#0B3D32]"
          }`}
          onClick={() => setTab("current")}
        >
          Current
          <b
            className={`grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 font-sans text-[10px] font-bold leading-none ${
              tab === "current" ? "bg-[#0B3D32] text-white" : "bg-[#DCE5D7] text-[#0B3D32]"
            }`}
          >
            {current.length}
          </b>
        </button>
        <button
          className={`${tab === "history" ? "active" : ""} -mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-sans text-[13px] font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] ${
            tab === "history" ? "border-[#0B3D32] text-[#0B3D32]" : "border-transparent text-[#6B756F] hover:text-[#0B3D32]"
          }`}
          onClick={() => setTab("history")}
        >
          History
        </button>
      </div>

      {tab === "current" &&
        (current.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="You are not borrowing any books"
              text="Find a book to borrow from the library."
              action={
                <button className={PRIMARY_BTN} onClick={() => navigate("/student/books")}>
                  Browse Books
                </button>
              }
            />
          </div>
        ) : (
          <div className="req-list mt-6 flex flex-col gap-4">
            {current.map((l) => {
              const b = books[l.book_id];
              const rs = api.renewalState(l);
              const left = daysUntil(l.due_date);
              const overdue = left < 0;
              const soon = !overdue && left <= CONFIG.DUE_SOON_DAYS;
              return (
                <div
                  className={`req relative flex flex-col gap-4 overflow-hidden rounded-[16px] border bg-[#FBFAF5] p-4 shadow-[0_4px_14px_rgba(11,61,50,0.05)] transition-all duration-300 ease-[cubic-bezier(.22,.8,.3,1)] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(11,61,50,0.1)] sm:flex-row sm:items-center sm:gap-6 sm:p-5 ${
                    overdue ? "border-[#E6C7BD]" : soon ? "border-[#B98A4A]/60" : "border-[#D9DDD7]"
                  }`}
                  key={l.borrow_id}
                >
                  {(overdue || soon) && (
                    <span className={`absolute inset-y-0 left-0 w-1 ${overdue ? "bg-[#8A3B35]" : "bg-[#B98A4A]"}`} aria-hidden="true" />
                  )}

                  <div className="mini w-[84px] shrink-0 overflow-hidden rounded-[8px] shadow-[0_8px_18px_rgba(7,53,44,0.2)] sm:w-[96px]">
                    <Cover book={b} />
                  </div>

                  <div className="req-info flex min-w-0 flex-1 flex-col gap-1.5">
                    <h3 className="font-serif text-[20px] font-medium leading-snug text-[#0B3D32]">{b.title}</h3>
                    <p className="font-sans text-[13px] text-[#6B756F]">
                      {b.author} · Copy {copies[l.copy_id].accession_no}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
                      <Badge status={loanStatus(l)} />
                      <span
                        className={`rounded-full px-3 py-1 font-sans text-[11.5px] font-bold ${
                          overdue
                            ? "bg-[#F1DDD6] text-[#8A3B35]"
                            : soon
                              ? "bg-[#F6ECD5] text-[#7A5A1C]"
                              : "bg-[#DCE5D7] text-[#0B3D32]"
                        }`}
                      >
                        {left >= 0 ? `${left} days left` : `${-left} days late`}
                      </span>
                    </div>

                    <p className="muted mt-1 font-sans text-[12px] leading-relaxed text-[#6B756F]">
                      Borrowed {fmtDate(l.borrow_date)} ·{" "}
                      <span className={overdue ? "font-bold text-[#8A3B35]" : "font-medium text-[#1F2A27]"}>Due {fmtDate(l.due_date)}</span> (
                      {left >= 0 ? `${left} days left` : `${-left} days late`}) · Renewals {l.renewal_count} of {CONFIG.RENEWAL_LIMIT}
                    </p>
                    {!rs.ok && <small className="reason block font-sans text-[11.5px] text-[#8A3B35]">{rs.reason}</small>}
                  </div>

                  <div className="flex shrink-0 flex-col sm:items-end">
                    <button className={GHOST_BTN} disabled={!rs.ok} onClick={() => setRenewing(l)}>
                      Renew
                    </button>
                  </div>
                </div>
              );
            })}
            <p className="muted font-sans text-[12px] text-[#6B756F]">
              Returns are confirmed by a librarian at the library counter. Bring the book to the library.
            </p>
          </div>
        ))}

      {tab === "history" && (
        <div className="mt-6">
          <div className="toolbar mb-5 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
            <select className={controlCls} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="all">All</option>
              <option value="Returned">Returned</option>
              <option value="Lost">Lost</option>
            </select>
            <input className={controlCls} type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <input className={controlCls} type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          </div>
          {history.length === 0 ? (
            <EmptyState title="No past loans" text="Returned and lost books appear here." />
          ) : (
            <>
              <div className="tbl-wrap overflow-x-auto rounded-[16px] border border-[#D9DDD7] bg-[#FBFAF5] shadow-[0_4px_14px_rgba(11,61,50,0.05)]">
                <table className="tbl w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={TH_CLS}>Book</th>
                      <th className={TH_CLS}>Copy</th>
                      <th className={TH_CLS}>Borrowed</th>
                      <th className={TH_CLS}>Closed</th>
                      <th className={TH_CLS}>Condition</th>
                      <th className={TH_CLS}>Days overdue</th>
                      <th className={TH_CLS}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pg.slice.map((l) => (
                      <tr key={l.borrow_id} className="transition-colors duration-150 hover:bg-[#F5F3EA]">
                        <td className={`${TD_CLS} font-serif text-[14.5px] text-[#0B3D32]`}>{books[l.book_id].title}</td>
                        <td className={TD_CLS}>{copies[l.copy_id].accession_no}</td>
                        <td className={TD_CLS}>{fmtDate(l.borrow_date)}</td>
                        <td className={TD_CLS}>{fmtDate(l.closedAt)}</td>
                        <td className={TD_CLS}>{l.ret?.condition_status ?? "—"}</td>
                        <td className={TD_CLS}>{l.ret?.days_overdue ?? "—"}</td>
                        <td className={TD_CLS}>
                          <Badge status={l.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-6">
                <Pager page={pg.page} pages={pg.pages} onChange={pg.setPage} />
              </div>
            </>
          )}
          {!hasUnpaid && penalties.length > 0 && <PenaltiesPanel penalties={penalties} books={books} loans={allLoans} />}
        </div>
      )}

      {renewing && <RenewDialog loan={renewing} book={books[renewing.book_id]} onClose={() => setRenewing(null)} />}
    </div>
  );
}