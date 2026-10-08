import { useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import { useLive } from "../../hooks/useLive";
import * as api from "../../services/api";
import * as lib from "../../services/librarian";
import { CONFIG } from "../../utils/constants";

const PRIMARY_SM =
  "btn primary sm inline-flex h-9 w-full items-center justify-center rounded-[10px] bg-[#0B3D32] px-5 font-sans text-[12px] font-bold tracking-[0.03em] text-white shadow-[0_4px_10px_rgba(11,61,50,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#07352C] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] sm:w-auto";

// Renewal rules are checked automatically (limit, overdue, restrictions, someone waiting).
// The librarian sees each loan's eligibility and can renew an eligible loan at the counter.
export default function Renewals() {
  const { act } = useAuthedLibrary();
  const rows = useLive(lib.getRenewalRows);
  const [tab, setTab] = useState<"eligible" | "blocked">("eligible");
  const [target, setTarget] = useState<lib.RenewalRow | null>(null);
  const [busy, wrap] = useBusy();

  const shown = rows.filter((r) => (tab === "eligible" ? r.eligible : !r.eligible));
  const eligibleCount = rows.filter((r) => r.eligible).length;
  const blockedCount = rows.filter((r) => !r.eligible).length;
  const confirm = wrap(async () => {
    if (!target) return;
    // TEMPORARY MOCK: renewLoan checks ownership by user id, so the counter renews on the student's behalf.
    // BACKEND REPLACEMENT: POST /librarian/loans/:id/renew (staff role), same eligibility rules on the server.
    const res = await act(api.renewLoan(target.userId, target.id), "Loan renewed.");
    if (res.ok) setTarget(null);
  });

  const columns: Column<lib.RenewalRow>[] = [
    { key: "student", label: "Student", render: (r) => <span className="font-sans text-[13.5px] font-bold text-[#0B3D32]">{r.student}</span> },
    { key: "book", label: "Book", render: (r) => <span className="font-serif text-[15px] font-medium text-[#0B3D32]">{r.book}</span> },
    { key: "due", label: "Due", render: (r) => <span className="font-sans text-[13px] font-bold text-[#1F2A27]">{r.due}</span> },
    {
      key: "renewals",
      label: "Renewed",
      render: (r) => (
        <span className="inline-flex items-center rounded-full border border-[#D9DDD7] bg-[#F5F3EA] px-3 py-1 font-sans text-[12px] font-bold text-[#0B3D32]">
          {r.renewals} / {CONFIG.RENEWAL_LIMIT}
        </span>
      ),
    },
    { key: "eligible", label: "Eligibility", render: (r) => (r.eligible ? <Badge status="Available">Eligible</Badge> : <Badge status="Rejected">Not eligible</Badge>) },
    {
      key: "reason",
      label: "Why",
      render: (r) => (
        <span className={`font-sans text-[12.5px] ${r.eligible ? "text-[#6B756F]" : "text-[#8A3B35]"}`}>
          {r.eligible ? `New due date ${r.newDue}` : r.reason}
        </span>
      ),
    },
    { key: "actions", label: "", render: (r) => (r.eligible ? <button className={PRIMARY_SM} onClick={() => setTarget(r)}>Renew</button> : null) },
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
              Renewals
            </h1>
          </div>
          <div className="inline-flex items-center gap-3 self-start rounded-[14px] border border-[#6F9B78] bg-[#F5F3EA] px-5 py-3 sm:self-auto">
            <b className="font-serif text-[32px] font-medium leading-none text-[#0B3D32]">{eligibleCount}</b>
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B756F]">Eligible to renew</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs mt-6 flex gap-2 overflow-x-auto border-b border-[#D9DDD7]">
        <button className={tabCls(tab === "eligible")} onClick={() => setTab("eligible")}>
          Eligible <b className={pillCls(tab === "eligible")}>{eligibleCount}</b>
        </button>
        <button className={tabCls(tab === "blocked")} onClick={() => setTab("blocked")}>
          Not eligible <b className={pillCls(tab === "blocked")}>{blockedCount}</b>
        </button>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-[16px] border border-[#D9DDD7] bg-[#FBFAF5] p-1 shadow-[0_4px_14px_rgba(11,61,50,0.05)]">
        <DataTable columns={columns} rows={shown} empty="No loans here." />
      </div>

      {target && (
        <ConfirmDialog title="Renew this loan?" confirmLabel="Renew" busy={busy} onConfirm={confirm} onClose={() => setTarget(null)}>
          <div className="flex flex-col gap-3">
            <div className="rounded-[12px] border border-[#D9DDD7] bg-[#F5F3EA] px-4 py-3">
              <p className="font-sans text-[14px] text-[#1F2A27]">
                <b className="text-[#0B3D32]">{target.student}</b>
              </p>
              <p className="font-serif text-[18px] font-medium leading-snug text-[#0B3D32]">“{target.book}”</p>
            </div>
            <p className="muted rounded-[10px] border border-[#D9C19A] bg-[#FBFAF5] px-4 py-3 font-sans text-[13px] text-[#6B756F]">
              The due date moves from <b className="text-[#0B3D32]">{target.due}</b> to <b className="text-[#0B3D32]">{target.newDue}</b>.
            </p>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}