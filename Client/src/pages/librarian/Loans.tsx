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
    { key: "borrowed", label: "Borrowed", render: (l) => <span className="font-sans text-[13px] text-[#6B756F]">{l.borrowed}</span> },
    { key: "due", label: "Due", render: (l) => <span className="font-sans text-[13px] font-bold text-[#1F2A27]">{l.due}</span> },
    { key: "renewals", label: "Renewals" },
    { key: "status", label: "Status", render: (l) => <Badge status={l.status} /> },
  ];

  const tabCls = (active: boolean) =>
    `${active ? "active" : ""} -mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-sans text-[13px] font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] ${
      active ? "border-[#0B3D32] text-[#0B3D32]" : "border-transparent text-[#6B756F] hover:text-[#0B3D32]"
    }`;
  const pillCls = (active: boolean) =>
    `grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 font-sans text-[10px] font-bold leading-none ${
      active ? "bg-[#0B3D32] text-white" : "bg-[#DCE5D7] text-[#0B3D32]"
    }`;

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
              Loans
            </h1>
          </div>
          <div className="inline-flex items-center gap-3 self-start rounded-[14px] border border-[#6F9B78] bg-[#F5F3EA] px-5 py-3 sm:self-auto">
            <b className="font-serif text-[32px] font-medium leading-none text-[#0B3D32]">{open.length}</b>
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B756F]">Currently borrowed</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs mt-6 flex gap-2 overflow-x-auto border-b border-[#D9DDD7]">
        <button className={tabCls(tab === "open")} onClick={() => setTab("open")}>
          Currently borrowed <b className={pillCls(tab === "open")}>{open.length}</b>
        </button>
        <button className={tabCls(tab === "history")} onClick={() => setTab("history")}>
          History <b className={pillCls(tab === "history")}>{history.length}</b>
        </button>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-[16px] border border-[#D9DDD7] bg-[#FBFAF5] p-1 shadow-[0_4px_14px_rgba(11,61,50,0.05)]">
        <DataTable columns={columns} rows={tab === "open" ? open : history} empty="No loans here." />
      </div>
    </div>
  );
}