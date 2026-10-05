import { useState } from "react";
import Badge from "../../components/Badge";
import DataTable, { type Column } from "../../components/DataTable";
import { useLive } from "../../hooks/useLive";
import * as lib from "../../services/librarian";

// Read-only loan ledger: BORROWED loans on one tab, closed loans (RETURNED / Lost) on the other.
export default function Loans() {
  const open = useLive(lib.getOpenLoans);
  const history = useLive(lib.getLoanHistory);
  const [tab, setTab] = useState<"open" | "history">("open");

  const columns: Column<lib.LoanRow>[] = [
    { key: "student", label: "Student" },
    { key: "book", label: "Book" },
    { key: "accessionNo", label: "Copy" },
    { key: "borrowed", label: "Borrowed" },
    { key: "due", label: "Due" },
    { key: "renewals", label: "Renewals" },
    { key: "status", label: "Status", render: (l) => <Badge status={l.status} /> },
  ];

  return (
    <>
      <span className="eyebrow">LIBRARIAN</span>
      <h1 className="page-title">Loans</h1>
      <div className="tabs">
        <button className={tab === "open" ? "active" : ""} onClick={() => setTab("open")}>Currently borrowed <b>{open.length}</b></button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History <b>{history.length}</b></button>
      </div>
      <DataTable columns={columns} rows={tab === "open" ? open : history} empty="No loans here." />
    </>
  );
}