import { useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import { useLive } from "../../hooks/useLive";
import * as api from "../../services/api";
import * as lib from "../../services/librarian";
import type { ConditionStatus } from "../../types";

type Dialog = { kind: "return" | "lost"; row: lib.LoanRow } | null;

const PRIMARY_SM =
  "btn primary sm inline-flex h-9 w-full items-center justify-center rounded-[10px] bg-[#0B3D32] px-4 font-sans text-[12px] font-bold tracking-[0.03em] text-white shadow-[0_4px_10px_rgba(11,61,50,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#07352C] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] sm:w-auto";
const GHOST_SM =
  "btn ghost sm inline-flex h-9 w-full items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-4 font-sans text-[12px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] sm:w-auto";
const CONTROL_CLS =
  "input h-11 rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-3.5 font-sans text-[13px] text-[#1F2A27] shadow-none transition-all duration-200 placeholder:text-[#9AA59F] hover:border-[#6F9B78] focus:border-[#6F9B78] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6F9B78]/40";
const FIELD_CLS = "field flex min-w-0 flex-col gap-1.5";
const LABEL_CLS = "font-sans text-[11px] font-bold tracking-[0.03em] text-[#0B3D32]";
const INPUT_CLS =
  "h-11 w-full rounded-[10px] border border-[#D9DDD7] bg-[#F5F3EA] px-3.5 font-sans text-[13.5px] text-[#1F2A27] transition-all duration-200 placeholder:text-[#9AA59F] focus:border-[#6F9B78] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6F9B78]/40";
const ERROR_CLS = "form-error rounded-[10px] border border-[#E6C7BD] bg-[#F1DDD6] px-3 py-2 font-sans text-[12px] text-[#8A3B35]";
const NOTE_CLS = "muted rounded-[10px] border border-[#D9C19A] bg-[#FBFAF5] px-4 py-3 font-sans text-[13px] leading-relaxed text-[#6B756F]";

// Receiving a book never gets blocked by overdue, penalties or suspension. A Good return makes the copy AVAILABLE.
export default function Returns() {
  const { user, act } = useAuthedLibrary();
  const loans = useLive(lib.getOpenLoans);
  const recent = useLive(lib.getRecentReturns);
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [condition, setCondition] = useState<ConditionStatus>("Good");
  const [scanned, setScanned] = useState("");
  const [remarks, setRemarks] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, wrap] = useBusy();

  const term = q.trim().toLowerCase();
  const rows = loans.filter((l) => !term || [l.student, l.book, l.accessionNo].some((s) => s.toLowerCase().includes(term)));

  const open = (kind: "return" | "lost", row: lib.LoanRow) => {
    setDialog({ kind, row });
    setCondition("Good");
    setScanned("");
    setRemarks("");
    setAmount("");
  };
  const close = () => setDialog(null);

  const confirm = wrap(async () => {
    if (!dialog) return;
    const { row, kind } = dialog;
    const res =
      kind === "return"
        ? await act(api.returnLoan(user.user_id, { borrowId: row.id, condition, scannedAccessionNo: scanned, remarks, damagedAmount: amount }), "Return recorded.")
        : await act(api.markLost(user.user_id, { borrowId: row.id, amount: amount === "" ? undefined : Number(amount) }), "Loan marked lost and a penalty was created.");
    if (res.ok) close();
  });

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
    { key: "due", label: "Due", render: (l) => <span className="font-sans text-[13px] font-bold text-[#1F2A27]">{l.due}</span> },
    { key: "status", label: "Status", render: (l) => <Badge status={l.status} /> },
    {
      key: "actions",
      label: "",
      render: (l) => (
        <div className="row-actions flex flex-wrap gap-2">
          <button className={PRIMARY_SM} onClick={() => open("return", l)}>Receive return</button>
          <button className={GHOST_SM} onClick={() => open("lost", l)}>Mark lost</button>
        </div>
      ),
    },
  ];
  const recentColumns: Column<lib.ReturnRow>[] = [
    { key: "student", label: "Student", render: (r) => <span className="font-sans text-[13.5px] font-bold text-[#0B3D32]">{r.student}</span> },
    { key: "book", label: "Book", render: (r) => <span className="font-serif text-[15px] font-medium text-[#0B3D32]">{r.book}</span> },
    { key: "accessionNo", label: "Copy" },
    { key: "returned", label: "Returned" },
    { key: "condition", label: "Condition", render: (r) => <Badge status={r.condition} /> },
    { key: "late", label: "Days late" },
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
              Returns
            </h1>
          </div>
          <div className="inline-flex items-center gap-3 self-start rounded-[14px] border border-[#6F9B78] bg-[#F5F3EA] px-5 py-3 sm:self-auto">
            <b className="font-serif text-[32px] font-medium leading-none text-[#0B3D32]">{loans.length}</b>
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B756F]">Out on loan</span>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="toolbar mt-6 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
        <input
          className={`${CONTROL_CLS} grow sm:min-w-[320px]`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search student, book or copy ID…"
        />
      </div>

      {/* Open loans */}
      <div className="mt-2 overflow-x-auto rounded-[16px] border border-[#D9DDD7] bg-[#FBFAF5] p-1 shadow-[0_4px_14px_rgba(11,61,50,0.05)]">
        <DataTable columns={columns} rows={rows} empty="No books are out on loan." />
      </div>

      {/* Recent returns */}
      <div className="section-head mb-4 mt-10 flex items-end justify-between gap-3">
        <div>
          <span className="eyebrow block font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">Circulation log</span>
          <h2 className="font-serif text-[26px] font-medium leading-tight text-[#0B3D32]">Recent returns</h2>
        </div>
      </div>
      <div className="overflow-x-auto rounded-[16px] border border-[#D9DDD7] bg-[#FBFAF5] p-1 shadow-[0_4px_14px_rgba(11,61,50,0.05)]">
        <DataTable columns={recentColumns} rows={recent} empty="No returns yet." />
      </div>

      {dialog?.kind === "return" && (
        <ConfirmDialog title="Confirm return" confirmLabel="Confirm return" busy={busy} confirmDisabled={!scanned.trim()} onConfirm={confirm} onClose={close}>
          <div className="flex flex-col gap-4">
            <div className="rounded-[12px] border border-[#D9DDD7] bg-[#F5F3EA] px-4 py-3">
              <span className="eyebrow block font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">Return</span>
              <p className="mt-1 font-sans text-[14px] text-[#1F2A27]">
                <b className="text-[#0B3D32]">{dialog.row.student}</b> · copy {dialog.row.accessionNo}
              </p>
              <p className="font-serif text-[18px] font-medium leading-snug text-[#0B3D32]">“{dialog.row.book}”</p>
            </div>
            {dialog.row.late > 0 && (
              <p className={ERROR_CLS}>
                {dialog.row.late} day(s) overdue: a penalty of {dialog.row.fine.toFixed(2)} will be created.
              </p>
            )}
            <label className={FIELD_CLS}>
              <span className={LABEL_CLS}>Scan the copy (accession number)</span>
              <input className={INPUT_CLS} value={scanned} onChange={(e) => setScanned(e.target.value)} placeholder={dialog.row.accessionNo} />
            </label>
            <label className={FIELD_CLS}>
              <span className={LABEL_CLS}>Condition</span>
              <select className={INPUT_CLS} value={condition} onChange={(e) => setCondition(e.target.value as ConditionStatus)}>
                <option>Good</option>
                <option>Damaged</option>
              </select>
            </label>
            {condition === "Damaged" && (
              <label className={FIELD_CLS}>
                <span className={LABEL_CLS}>Damage penalty (optional)</span>
                <input className={INPUT_CLS} type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
            )}
            <label className={FIELD_CLS}>
              <span className={LABEL_CLS}>Remarks</span>
              <input className={INPUT_CLS} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </label>
            <p className={NOTE_CLS}>
              {condition === "Good"
                ? "The copy becomes AVAILABLE and the next student in the queue is notified."
                : "The copy goes to MAINTENANCE until you put it back on the shelf."}
            </p>
          </div>
        </ConfirmDialog>
      )}
      {dialog?.kind === "lost" && (
        <ConfirmDialog title="Mark this loan lost?" confirmLabel="Mark lost" danger busy={busy} onConfirm={confirm} onClose={close}>
          <div className="flex flex-col gap-4">
            <div className="rounded-[12px] border border-[#E6C7BD] bg-[#F1DDD6]/40 px-4 py-3">
              <p className="font-sans text-[14px] text-[#1F2A27]">
                <b className="text-[#0B3D32]">{dialog.row.student}</b> · copy {dialog.row.accessionNo}
              </p>
              <p className="font-serif text-[18px] font-medium leading-snug text-[#0B3D32]">“{dialog.row.book}”</p>
            </div>
            <label className={FIELD_CLS}>
              <span className={LABEL_CLS}>Penalty amount (blank = book price)</span>
              <input className={INPUT_CLS} type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <p className={NOTE_CLS}>The copy is removed from circulation. This cannot be undone.</p>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}