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

  return (
    <>
      <span className="eyebrow">ADMIN</span>
      <h1 className="page-title">Monitoring</h1>
      <div className="tabs">
        {(Object.keys(TABS) as TabKey[]).map((k) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
            {TABS[k][0]} <b>{data[k].length}</b>
          </button>
        ))}
      </div>
      <DataTable columns={TABS[tab][1]} rows={data[tab]} empty="Nothing to show." />
    </>
  );
}