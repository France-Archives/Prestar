import { useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import DataTable, { type Column } from "../../components/DataTable";
import { useLive } from "../../hooks/useLive";
import * as lib from "../../services/librarian";
import { CONFIG } from "../../utils/constants";

const PRIMARY_SM =
  "btn primary sm inline-flex h-9 w-full items-center justify-center rounded-[10px] bg-[#0B3D32] px-5 font-sans text-[12px] font-bold tracking-[0.03em] text-white shadow-[0_4px_10px_rgba(11,61,50,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#07352C] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] sm:w-auto";

// Overdue is derived: a BORROWED loan whose due date is in the past. Nothing is stored for it.
export default function Overdue() {
  const navigate = useNavigate();
  const rows = useLive(lib.getOverdueLoans);

  const columns: Column<lib.LoanRow>[] = [
    { key: "student", label: "Student", render: (l) => <span className="font-sans text-[13.5px] font-bold text-[#0B3D32]">{l.student}</span> },
    { key: "book", label: "Book", render: (l) => <span className="font-serif text-[15px] font-medium text-[#0B3D32]">{l.book}</span> },
    {
      key: "accessionNo",
      label: "Copy",
      render: (l) => (
        <span className="inline-flex items-center rounded-[8px] border border-[#D9DDD7] bg-[#F5F3EA] px-2.5 py-1 font-sans text-[12px] font-medium text-[#1F2A27]">
          {l.accessionNo}
        </span>
      ),
    },
    { key: "due", label: "Due date", render: (l) => <span className="font-sans text-[13px] font-bold text-[#8A3B35]">{l.due}</span> },
    { key: "late", label: "Days overdue", render: (l) => <Badge status="Overdue">{l.late} day{l.late === 1 ? "" : "s"}</Badge> },
    {
      key: "fine",
      label: "Penalty if returned today",
      render: (l) => <span className="font-sans text-[13px] font-medium text-[#1F2A27]">{l.fine.toFixed(2)}</span>,
    },
    {
      key: "actions",
      label: "",
      render: () => (
        <button className={PRIMARY_SM} onClick={() => navigate("/librarian/returns")}>
          Receive return
        </button>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full font-sans text-[#1F2A27]">
      {/* Header */}
      <header className="relative overflow-hidden rounded-[22px] border border-[#D9DDD7] bg-[#FBFAF5] px-5 py-8 shadow-[0_4px_14px_rgba(11,61,50,0.05)] sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#DCE5D7]/80 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-[#D9C19A]/40 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow mb-2 inline-flex items-center gap-2 font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">
              <span className="h-px w-8 bg-[#B98A4A]" />
              LIBRARIAN
            </span>
            <h1 className="page-title font-serif text-[clamp(32px,5.5vw,52px)] font-medium leading-[1.08] tracking-[-0.01em] text-[#0B3D32]">
              Overdue
            </h1>
            <p className="muted mt-3 max-w-[70ch] font-sans text-[13.5px] leading-relaxed text-[#6B756F]">
              Penalty rate: {CONFIG.OVERDUE_FINE_PER_DAY.toFixed(2)} per day (placeholder rule). The penalty is created when the book is returned.
            </p>
          </div>
          {rows.length > 0 && (
            <div className="inline-flex items-center gap-3 self-start rounded-[14px] border border-[#E6C7BD] bg-[#F1DDD6]/50 px-5 py-3 sm:self-auto">
              <b className="font-serif text-[32px] font-medium leading-none text-[#8A3B35]">{rows.length}</b>
              <span className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A3B35]">Overdue loans</span>
            </div>
          )}
        </div>
      </header>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-[16px] border border-[#D9DDD7] bg-[#FBFAF5] p-1 shadow-[0_4px_14px_rgba(11,61,50,0.05)]">
        <DataTable columns={columns} rows={rows} empty="No overdue loans." />
      </div>
    </div>
  );
}