import { useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import { useLive } from "../../hooks/useLive";
import * as api from "../../services/api";
import * as lib from "../../services/librarian";
import type { SuspensionReason } from "../../types";

type Dialog = { kind: "pay" | "waive"; row: lib.PenaltyRow } | { kind: "suspend" } | { kind: "lift"; row: lib.SuspensionRow } | null;
const REASONS: SuspensionReason[] = ["Violation", "Lost Book", "Damaged Book", "Other"];

const PRIMARY_SM =
  "btn primary sm inline-flex h-9 w-full items-center justify-center rounded-[10px] bg-[#0B3D32] px-4 font-sans text-[12px] font-bold tracking-[0.03em] text-white shadow-[0_4px_10px_rgba(11,61,50,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#07352C] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] sm:w-auto";
const GHOST_SM =
  "btn ghost sm inline-flex h-9 w-full items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-4 font-sans text-[12px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] sm:w-auto";
const FIELD_CLS = "field flex min-w-0 flex-1 flex-col gap-1.5";
const LABEL_CLS = "font-sans text-[11px] font-bold tracking-[0.03em] text-[#0B3D32]";
const INPUT_CLS =
  "h-11 w-full rounded-[10px] border border-[#D9DDD7] bg-[#F5F3EA] px-3.5 font-sans text-[13.5px] text-[#1F2A27] transition-all duration-200 placeholder:text-[#9AA59F] focus:border-[#6F9B78] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6F9B78]/40";

// Penalties are paid in cash at the counter (no online payment). Suspensions block new borrowing only.
export default function Penalties() {
  const { user, act } = useAuthedLibrary();
  const penalties = useLive(lib.getPenaltyRows);
  const suspensions = useLive(lib.getSuspensionRows);
  const students = useLive(lib.getStudentOptions);
  const [tab, setTab] = useState<"penalties" | "suspensions">("penalties");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState(""); // receipt number, waive reason or lift remarks
  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState<SuspensionReason>("Violation");
  const [endDate, setEndDate] = useState("");
  const [busy, wrap] = useBusy();

  const open = (d: Dialog) => {
    setDialog(d);
    setText("");
    setStudentId("");
    setReason("Violation");
    setEndDate("");
  };
  const close = () => setDialog(null);

  const confirm = wrap(async () => {
    if (!dialog) return;
    let res;
    if (dialog.kind === "pay") res = await act(api.payPenalty(user.user_id, dialog.row.id, text), "Payment recorded.");
    else if (dialog.kind === "waive") res = await act(api.waivePenalty(user.user_id, dialog.row.id, text), "Penalty waived.");
    else if (dialog.kind === "lift") res = await act(api.liftSuspension(user.user_id, dialog.row.id, text), "Suspension lifted.");
    else res = await act(api.createSuspension(user.user_id, { userId: Number(studentId), reasonType: reason, reasonDetails: text, endDate }), "Student suspended.");
    if (res.ok) close();
  });

  const penaltyColumns: Column<lib.PenaltyRow>[] = [
    { key: "student", label: "Student", render: (p) => <span className="font-sans text-[13.5px] font-bold text-[#0B3D32]">{p.student}</span> },
    { key: "book", label: "Book", render: (p) => <span className="font-serif text-[15px] font-medium text-[#0B3D32]">{p.book}</span> },
    { key: "type", label: "Type" },
    {
      key: "amount",
      label: "Amount",
      render: (p) => (
        <span className={`font-sans text-[13.5px] font-bold ${p.status === "Unpaid" ? "text-[#8A3B35]" : "text-[#1F2A27]"}`}>{p.amount}</span>
      ),
    },
    { key: "status", label: "Status", render: (p) => <Badge status={p.status} /> },
    { key: "created", label: "Created" },
    { key: "receipt", label: "Receipt" },
    {
      key: "actions",
      label: "",
      render: (p) =>
        p.status === "Unpaid" ? (
          <div className="row-actions flex flex-wrap gap-2">
            <button className={PRIMARY_SM} onClick={() => open({ kind: "pay", row: p })}>Record payment</button>
            <button className={GHOST_SM} onClick={() => open({ kind: "waive", row: p })}>Waive</button>
          </div>
        ) : null,
    },
  ];
  const suspensionColumns: Column<lib.SuspensionRow>[] = [
    { key: "student", label: "Student", render: (s) => <span className="font-sans text-[13.5px] font-bold text-[#0B3D32]">{s.student}</span> },
    { key: "reason", label: "Reason" },
    { key: "details", label: "Details" },
    { key: "start", label: "From" },
    { key: "end", label: "Until" },
    { key: "status", label: "Status", render: (s) => <Badge status={s.status} /> },
    {
      key: "actions",
      label: "",
      render: (s) => (s.status === "Active" ? <button className={GHOST_SM} onClick={() => open({ kind: "lift", row: s })}>Lift</button> : null),
    },
  ];

  const titles = { pay: "Record payment", waive: "Waive penalty", lift: "Lift suspension", suspend: "Suspend a student" } as const;
  const needsText = dialog?.kind !== "lift";
  const unpaidCount = penalties.filter((p) => p.status === "Unpaid").length;
  const activeSusp = suspensions.filter((s) => s.status === "Active").length;

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
              Penalties &amp; Suspensions
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <div
              className={`inline-flex items-center gap-3 rounded-[14px] border px-5 py-3 ${
                unpaidCount > 0 ? "border-[#E6C7BD] bg-[#F1DDD6]/50" : "border-[#6F9B78] bg-[#F5F3EA]"
              }`}
            >
              <b className={`font-serif text-[32px] font-medium leading-none ${unpaidCount > 0 ? "text-[#8A3B35]" : "text-[#0B3D32]"}`}>{unpaidCount}</b>
              <span className={`font-sans text-[11px] font-bold uppercase tracking-[0.14em] ${unpaidCount > 0 ? "text-[#8A3B35]" : "text-[#6B756F]"}`}>Unpaid</span>
            </div>
            <div className="inline-flex items-center gap-3 rounded-[14px] border border-[#D9DDD7] bg-[#F5F3EA] px-5 py-3">
              <b className="font-serif text-[32px] font-medium leading-none text-[#0B3D32]">{activeSusp}</b>
              <span className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B756F]">Active suspensions</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs mt-6 flex gap-2 overflow-x-auto border-b border-[#D9DDD7]">
        <button className={tabCls(tab === "penalties")} onClick={() => setTab("penalties")}>
          Penalties <b className={pillCls(tab === "penalties")}>{unpaidCount}</b>
        </button>
        <button className={tabCls(tab === "suspensions")} onClick={() => setTab("suspensions")}>
          Suspensions <b className={pillCls(tab === "suspensions")}>{activeSusp}</b>
        </button>
      </div>

      {tab === "suspensions" && (
        <div className="toolbar mt-5 flex">
          <button className={PRIMARY_SM} onClick={() => open({ kind: "suspend" })}>Suspend a student</button>
        </div>
      )}

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-[16px] border border-[#D9DDD7] bg-[#FBFAF5] p-1 shadow-[0_4px_14px_rgba(11,61,50,0.05)]">
        {tab === "penalties" ? (
          <DataTable columns={penaltyColumns} rows={penalties} empty="No penalties." />
        ) : (
          <DataTable columns={suspensionColumns} rows={suspensions} empty="No suspensions." />
        )}
      </div>

      {dialog && (
        <ConfirmDialog
          title={titles[dialog.kind]}
          confirmLabel="Confirm"
          danger={dialog.kind === "suspend"}
          busy={busy}
          confirmDisabled={(needsText && !text.trim()) || (dialog.kind === "suspend" && !studentId)}
          onConfirm={confirm}
          onClose={close}
        >
          <div className="flex flex-col gap-4">
            {dialog.kind === "suspend" && (
              <>
                <label className={FIELD_CLS}>
                  <span className={LABEL_CLS}>Student</span>
                  <select className={INPUT_CLS} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                    <option value="">Choose…</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <div className="row flex flex-col gap-4 sm:flex-row">
                  <label className={FIELD_CLS}>
                    <span className={LABEL_CLS}>Reason</span>
                    <select className={INPUT_CLS} value={reason} onChange={(e) => setReason(e.target.value as SuspensionReason)}>
                      {REASONS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </label>
                  <label className={FIELD_CLS}>
                    <span className={LABEL_CLS}>Ends on (optional)</span>
                    <input className={INPUT_CLS} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </label>
                </div>
              </>
            )}
            {(dialog.kind === "pay" || dialog.kind === "waive") && (
              <div className="rounded-[12px] border border-[#D9DDD7] bg-[#F5F3EA] px-4 py-3">
                <p className="font-sans text-[14px] text-[#1F2A27]">
                  <b className="text-[#0B3D32]">{dialog.row.student}</b> · {dialog.row.type}
                </p>
                <p className="font-serif text-[22px] font-medium leading-snug text-[#0B3D32]">{dialog.row.amount}</p>
              </div>
            )}
            <label className={FIELD_CLS}>
              <span className={LABEL_CLS}>
                {dialog.kind === "pay" ? "Receipt number" : dialog.kind === "waive" ? "Reason for waiving" : dialog.kind === "lift" ? "Remarks (optional)" : "Details"}
              </span>
              <input className={INPUT_CLS} value={text} onChange={(e) => setText(e.target.value)} />
            </label>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}