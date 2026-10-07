import { useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import DataTable, { type Column } from "../../components/DataTable";
import { useLive } from "../../hooks/useLive";
import * as lib from "../../services/librarian";
import { CONFIG } from "../../utils/constants";

// Overdue is derived: a BORROWED loan whose due date is in the past. Nothing is stored for it.
export default function Overdue() {
  const navigate = useNavigate();
  const rows = useLive(lib.getOverdueLoans);

  const columns: Column<lib.LoanRow>[] = [
    { key: "student", label: "Student" },
    { key: "book", label: "Book" },
    { key: "accessionNo", label: "Copy" },
    { key: "due", label: "Due date" },
    { key: "late", label: "Days overdue", render: (l) => <Badge status="Overdue">{l.late} day{l.late === 1 ? "" : "s"}</Badge> },
    { key: "fine", label: "Penalty if returned today", render: (l) => l.fine.toFixed(2) },
    { key: "actions", label: "", render: () => <button className="btn primary sm" onClick={() => navigate("/librarian/returns")}>Receive return</button> },
  ];

  return (
    <>
      <span className="eyebrow">LIBRARIAN</span>
      <h1 className="page-title">Overdue</h1>
      <p className="muted">Penalty rate: {CONFIG.OVERDUE_FINE_PER_DAY.toFixed(2)} per day (placeholder rule). The penalty is created when the book is returned.</p>
      <DataTable columns={columns} rows={rows} empty="No overdue loans." />
    </>
  );
}