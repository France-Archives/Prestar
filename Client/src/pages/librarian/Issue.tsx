import { useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import { useLive } from "../../hooks/useLive";
import * as api from "../../services/api";
import * as lib from "../../services/librarian";
import { fmtDate } from "../../utils/dates";

const PRIMARY_SM =
  "btn primary sm inline-flex h-9 w-full items-center justify-center rounded-[10px] bg-[#0B3D32] px-5 font-sans text-[12px] font-bold tracking-[0.04em] text-white shadow-[0_4px_10px_rgba(11,61,50,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#07352C] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] sm:w-auto";

const FIELD_CLS = "field flex min-w-0 flex-col gap-1.5";
const LABEL_CLS = "font-sans text-[11px] font-bold tracking-[0.03em] text-[#0B3D32]";
const INPUT_CLS =
  "h-11 w-full rounded-[10px] border border-[#D9DDD7] bg-[#F5F3EA] px-3.5 font-sans text-[13.5px] text-[#1F2A27] transition-all duration-200 placeholder:text-[#9AA59F] focus:border-[#6F9B78] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6F9B78]/40";
const CHECK_CLS =
  "check flex cursor-pointer items-start gap-3 rounded-[12px] border border-[#D9DDD7] bg-[#F5F3EA] px-4 py-3 font-sans text-[13px] leading-snug text-[#1F2A27] transition-colors duration-200 hover:border-[#6F9B78]";
const CHECKBOX_CLS = "mt-0.5 h-4 w-4 shrink-0 accent-[#0B3D32]";
const ERROR_CLS = "form-error rounded-[10px] border border-[#E6C7BD] bg-[#F1DDD6] px-3 py-2 font-sans text-[12px] text-[#8A3B35]";

// Step 2 of lending: the physical handover. This is the ONLY place a loan (BORROWED) is created.
export default function Issue() {
  const { user, act } = useAuthedLibrary();
  const rows = useLive(lib.getIssueQueue);
  const [row, setRow] = useState<lib.IssueRow | null>(null);
  const [accessionNo, setAccessionNo] = useState("");
  const [studentOk, setStudentOk] = useState(false);
  const [copyOk, setCopyOk] = useState(false);
  const [busy, wrap] = useBusy();

  const open = (r: lib.IssueRow) => {
    setRow(r);
    // Left empty on purpose: the librarian must scan or type the copy in hand. The list below only suggests copies.
    setAccessionNo("");
    setStudentOk(false);
    setCopyOk(false);
  };
  const close = () => setRow(null);

  const confirm = wrap(async () => {
    if (!row) return;
    const payload = row.kind === "request" ? { requestId: row.sourceId, accessionNo } : { reservationId: row.sourceId, accessionNo };
    const res = await act(api.issueLoan(user.user_id, payload), "Book issued. The loan is now BORROWED.");
    if (res.ok) close();
  });

  const columns: Column<lib.IssueRow>[] = [
    { key: "student", label: "Student", render: (r) => <span className="font-sans text-[13.5px] font-bold text-[#0B3D32]">{r.student}</span> },
    { key: "standing", label: "Standing", render: (r) => <Badge status={r.standing} /> },
    { key: "book", label: "Book", render: (r) => <span className="font-serif text-[15px] font-medium text-[#0B3D32]">{r.book}</span> },
    {
      key: "kind",
      label: "From",
      render: (r) => (
        <span className="inline-flex items-center rounded-full border border-[#6F9B78] bg-[#DCE5D7] px-3 py-1 font-sans text-[11.5px] font-bold text-[#0B3D32]">
          {r.kind === "request" ? "Approved request" : "Ready reservation"}
        </span>
      ),
    },
    { key: "until", label: "Pick up by" },
    { key: "copies", label: "Copies on shelf", render: (r) => r.copies.length },
    { key: "actions", label: "", render: (r) => <button className={PRIMARY_SM} onClick={() => open(r)}>Issue</button> },
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
              Issue / Handover
            </h1>
            <p className="muted mt-3 max-w-[70ch] font-sans text-[13.5px] leading-relaxed text-[#6B756F]">
              Approved requests and ready reservations waiting for pickup. Approved is not borrowed: the loan starts only when you confirm the handover here.
            </p>
          </div>
          {rows.length > 0 && (
            <div className="inline-flex items-center gap-3 self-start rounded-[14px] border border-[#6F9B78] bg-[#F5F3EA] px-5 py-3 sm:self-auto">
              <b className="font-serif text-[32px] font-medium leading-none text-[#0B3D32]">{rows.length}</b>
              <span className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B756F]">Waiting for pickup</span>
            </div>
          )}
        </div>
      </header>

      {/* Queue */}
      <div className="mt-6 overflow-x-auto rounded-[16px] border border-[#D9DDD7] bg-[#FBFAF5] p-1 shadow-[0_4px_14px_rgba(11,61,50,0.05)]">
        <DataTable columns={columns} rows={rows} empty="Nobody is waiting for pickup." />
      </div>

      {row && (
        <ConfirmDialog
          title="Confirm handover"
          confirmLabel="Confirm issue"
          busy={busy}
          confirmDisabled={!studentOk || !copyOk || !accessionNo.trim() || row.blockers.length > 0}
          onConfirm={confirm}
          onClose={close}
        >
          <div className="flex flex-col gap-4">
            <div className="rounded-[12px] border border-[#D9DDD7] bg-[#F5F3EA] px-4 py-3">
              <span className="eyebrow block font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">Handover</span>
              <p className="mt-1 font-sans text-[14px] text-[#1F2A27]">
                <b className="text-[#0B3D32]">{row.student}</b>
              </p>
              <p className="font-serif text-[18px] font-medium leading-snug text-[#0B3D32]">“{row.book}”</p>
            </div>

            {row.blockers.length > 0 && <p className={ERROR_CLS}>{row.blockers[0]}</p>}

            <div className="flex flex-col gap-2">
              <span className="font-sans text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#6B756F]">Step 1 · Verify student</span>
              <label className={CHECK_CLS}>
                <input className={CHECKBOX_CLS} type="checkbox" checked={studentOk} onChange={(e) => setStudentOk(e.target.checked)} />
                <span>I checked the student’s ID against {row.student}</span>
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-sans text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#6B756F]">Step 2 · Physical copy</span>
              <label className={FIELD_CLS}>
                <span className={LABEL_CLS}>Physical copy (accession number)</span>
                <input
                  className={INPUT_CLS}
                  list="issue-copies"
                  value={accessionNo}
                  onChange={(e) => setAccessionNo(e.target.value)}
                  placeholder="Scan or type the accession number"
                />
                <datalist id="issue-copies">
                  {row.copies.map((c) => (
                    <option key={c.copyId} value={c.accessionNo} />
                  ))}
                </datalist>
              </label>
              {row.copies.length === 0 && <p className={ERROR_CLS}>No copy is on the shelf for this book.</p>}
              <label className={CHECK_CLS}>
                <input className={CHECKBOX_CLS} type="checkbox" checked={copyOk} onChange={(e) => setCopyOk(e.target.checked)} />
                <span>The copy in my hand matches this accession number and is in good condition</span>
              </label>
            </div>

            <p className="muted rounded-[10px] border border-[#D9C19A] bg-[#FBFAF5] px-4 py-3 font-sans text-[13px] text-[#6B756F]">
              Due date: <b className="text-[#0B3D32]">{fmtDate(row.dueDate)}</b> (set by the library rules)
            </p>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}