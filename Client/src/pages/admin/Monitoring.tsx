import { useMemo, useState } from "react";
import Badge from "../../components/Badge";
import DataTable, { type Column } from "../../components/DataTable";
import { useAuthedLibrary } from "../../context/LibraryContext";
import * as api from "../../services/api";
import * as lib from "../../services/librarian";
import type { ReportRow } from "../../services/reports";
import { daysOverdue, fmtDate, fmtDateTime } from "../../utils/dates";
import { fullName, indexBy } from "../../utils/lookup";

type TabKey = "loans" | "overdue" | "requests" | "reservations" | "penalties";

const statusBadge = (r: ReportRow) => <Badge status={String(r.status)} />;
const LOAN_COLS: Column<ReportRow>[] = [
  { key: "student", label: "Student" },
  { key: "book", label: "Book" },
  { key: "copy", label: "Copy" },
  { key: "due", label: "Due" },
  { key: "status", label: "Status", render: statusBadge },
];
const TABS: Record<TabKey, [string, Column<ReportRow>[]]> = {
  loans: ["Current loans", LOAN_COLS],
  overdue: ["Overdue", [...LOAN_COLS.slice(0, 4), { key: "late", label: "Days overdue" }]],
  requests: ["Pending requests", [{ key: "student", label: "Student" }, { key: "book", label: "Book" }, { key: "date", label: "Requested" }, { key: "free", label: "Free to request now" }]],
  reservations: ["Reservations", [{ key: "student", label: "Student" }, { key: "book", label: "Book" }, { key: "status", label: "Status", render: statusBadge }, { key: "info", label: "Details" }]],
  penalties: ["Unpaid penalties", [{ key: "student", label: "Student" }, { key: "book", label: "Book" }, { key: "type", label: "Type" }, { key: "amount", label: "Amount" }, { key: "date", label: "Created" }]],
};

const DESCRIPTIONS: Record<TabKey, string> = {
  loans: "Books that are currently out on loan.",
  overdue: "Open loans that are past their due date, longest overdue first.",
  requests: "Borrow requests waiting for a decision.",
  reservations: "Reservations that are still open.",
  penalties: "Penalties that have not been paid yet.",
};

// Left-border accent per monitoring area (PRESTAR palette).
const ACCENT: Record<TabKey, string> = {
  loans: "border-l-[#0B3D32]",
  overdue: "border-l-[#8A3B35]",
  requests: "border-l-[#B98A4A]",
  reservations: "border-l-[#6F9B78]",
  penalties: "border-l-[#D9C19A]",
};

const CARD = "bg-[#FBFAF5] border border-[#D9DDD7] rounded-[14px] shadow-[0_1px_2px_rgba(11,61,50,0.05)]";
const LABEL = "text-xs uppercase tracking-[0.08em] text-[#6B756F] font-medium";
const STAT_VALUE = "font-['Playfair_Display',serif] text-[28px] mt-1.5 leading-[1.1]";
const PANEL_HEADER =
  "flex flex-wrap justify-between items-baseline gap-2 px-5 py-4 border-b border-[#D9DDD7] bg-[#DCE5D7]";
const PANEL_TITLE = "font-['Playfair_Display',serif] text-xl text-[#07352C] m-0";
const PANEL_NOTE = "mt-1 mb-0 text-sm text-[#6B756F]";

export default function Monitoring() {
  const { db } = useAuthedLibrary();
  const [tab, setTab] = useState<TabKey>("loans");

  const data = useMemo((): Record<TabKey, ReportRow[]> => {
    const users = indexBy(db.users, "user_id");
    const books = indexBy(db.books, "book_id");
    const copies = indexBy(db.book_copies, "copy_id");
    const loans = indexBy(db.borrowed_books, "borrow_id");
    const loanRow = (l: (typeof db.borrowed_books)[number]): ReportRow => ({
      id: l.borrow_id,
      student: fullName(users[l.user_id]),
      book: books[l.book_id].title,
      copy: copies[l.copy_id].accession_no,
      due: fmtDate(l.due_date),
      late: daysOverdue(l.due_date),
      status: api.isOverdue(l) ? "Overdue" : "Borrowed",
    });
    const open = db.borrowed_books.filter((l) => l.status === "Borrowed");
    return {
      loans: open.map(loanRow),
      overdue: open.filter(api.isOverdue).map(loanRow).sort((a, b) => Number(b.late) - Number(a.late)),
      requests: db.borrow_requests
        .filter((r) => r.status === "Pending")
        .map((r) => ({ id: r.request_id, student: fullName(users[r.user_id]), book: books[r.book_id].title, date: fmtDateTime(r.request_date), free: api.freeToRequest(r.book_id) })),
      reservations: lib
        .getReservationRows()
        .filter((r) => r.open)
        .map((r): ReportRow => ({ id: r.id, student: r.student, book: r.book, status: r.status, info: r.info })),
      penalties: db.penalties
        .filter((p) => p.status === "Unpaid")
        .map((p) => ({ id: p.penalty_id, student: fullName(users[p.user_id]), book: books[loans[p.borrow_id].book_id].title, type: p.penalty_type, amount: p.amount.toFixed(2), date: fmtDate(p.created_at) })),
    };
  }, [db]);

  const keys = Object.keys(TABS) as TabKey[];
  const columns = TABS[tab][1];
  const rows = data[tab];

  const cell = (col: Column<ReportRow>, r: ReportRow) =>
    col.render ? col.render(r) : String((r as Record<string, unknown>)[col.key as string] ?? "—");

  return (
    <>
      <span className="eyebrow">ADMIN</span>
      <h1 className="page-title">Monitoring</h1>
      <p className="text-[#6B756F] mt-1 mb-5 max-w-[680px] leading-relaxed">
        Watch circulation across the library: loans, overdue items, pending requests, reservations and unpaid penalties.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`${CARD} ${ACCENT[k]} border-l-4 text-left cursor-pointer px-5 py-[18px] transition-colors hover:bg-[#F5F3EA] ${
              tab === k ? "!border-[#0B3D32] ring-1 ring-[#0B3D32]" : ""
            }`}
          >
            <div className={LABEL}>{TABS[k][0]}</div>
            <div className={`${STAT_VALUE} ${k === "overdue" && data[k].length > 0 ? "text-[#8A3B35]" : "text-[#0B3D32]"}`}>
              {data[k].length}
            </div>
          </button>
        ))}
      </div>

      <div className="tabs">
        {keys.map((k) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
            {TABS[k][0]} <b>{data[k].length}</b>
          </button>
        ))}
      </div>

      <section className={`${CARD} overflow-hidden mt-5`}>
        <header className={PANEL_HEADER}>
          <div>
            <h2 className={PANEL_TITLE}>{TABS[tab][0]}</h2>
            <p className={PANEL_NOTE}>{DESCRIPTIONS[tab]}</p>
          </div>
          <span className="text-[13px] font-medium text-[#1F2A27]">
            {rows.length} {rows.length === 1 ? "record" : "records"}
          </span>
        </header>

        {/* Desktop and tablet: monitoring table */}
        <div className="hidden md:block overflow-x-auto">
          <DataTable columns={columns} rows={rows} empty="Nothing to show." />
        </div>

        {/* Mobile: record cards */}
        <div className="md:hidden p-3 grid gap-3">
          {rows.length === 0 && <p className="muted text-center py-6 m-0">Nothing to show.</p>}
          {rows.map((r) => {
            const [first, second, ...rest] = columns;
            const badgeCol = columns.find((c) => c.key === "status");
            const detailCols = rest.filter((c) => c.key !== "status");
            return (
              <div
                key={String(r.id)}
                className={`bg-[#FBFAF5] border border-[#D9DDD7] border-l-4 ${ACCENT[tab]} rounded-[12px] px-4 py-3.5`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-['Playfair_Display',serif] text-[17px] text-[#0B3D32] leading-snug">
                      {cell(first, r)}
                    </div>
                    {second && <div className="text-[13px] text-[#6B756F]">{cell(second, r)}</div>}
                  </div>
                  {badgeCol && badgeCol !== first && badgeCol !== second && <div>{cell(badgeCol, r)}</div>}
                </div>

                {detailCols.length > 0 && (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-3 mb-0">
                    {detailCols.map((c) => (
                      <div key={String(c.key)}>
                        <dt className={LABEL}>{c.label}</dt>
                        <dd className="m-0 mt-0.5 text-sm text-[#1F2A27] break-words">{cell(c, r)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}