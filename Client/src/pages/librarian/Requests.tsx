import { useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import { useLive } from "../../hooks/useLive";
import * as api from "../../services/api";
import * as lib from "../../services/librarian";
import type { RequestStatus } from "../../types";

type Filter = "Pending" | "Approved" | "all";
type Action = { kind: "approve" | "reject"; row: lib.RequestRow };

const PRIMARY_SM =
  "btn primary sm inline-flex h-9 w-full items-center justify-center rounded-[10px] bg-[#0B3D32] px-4 font-sans text-[12px] font-medium text-white shadow-[0_4px_10px_rgba(11,61,50,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#07352C] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] sm:w-auto";
const GHOST_SM =
  "btn ghost sm inline-flex h-9 w-full items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-4 font-sans text-[12px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] sm:w-auto";

// Step 1 of lending: review. Approving only HOLDS a copy. The loan is created later on the Issue page.
export default function LibrarianRequests() {
  const { user, act } = useAuthedLibrary();
  const rows = useLive(lib.getBorrowRequests);
  const [filter, setFilter] = useState<Filter>("Pending");
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [busy, wrap] = useBusy();

  const shown = rows.filter((r) => filter === "all" || r.status === (filter as RequestStatus));
  const count = (s: RequestStatus) => rows.filter((r) => r.status === s).length;

  const close = () => {
    setAction(null);
    setReason("");
  };
  const confirm = wrap(async () => {
    if (!action) return;
    const id = action.row.id;
    const res =
      action.kind === "approve"
        ? await act(api.approveRequest(user.user_id, id), "Request approved. The student can now pick up the book.")
        : await act(api.rejectRequest(user.user_id, id, reason), "Request rejected.");
    if (res.ok) close();
  });

  const columns: Column<lib.RequestRow>[] = [
    {
      key: "student",
      label: "Student",
      render: (r) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-sans text-[13.5px] font-bold text-[#0B3D32]">{r.student}</span>
          <Badge status={r.standing} />
        </span>
      ),
    },
    { key: "book", label: "Book", render: (r) => <span className="font-serif text-[15px] font-medium text-[#0B3D32]">{r.book}</span> },
    { key: "date", label: "Request date" },
    { key: "free", label: "Free copies" },
    { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
    { key: "note", label: "Note" },
    {
      key: "actions",
      label: "",
      render: (r) =>
        r.status === "Pending" ? (
          <div className="row-actions flex flex-wrap gap-2">
            <button className={PRIMARY_SM} onClick={() => setAction({ kind: "approve", row: r })}>Approve</button>
            <button className={GHOST_SM} onClick={() => setAction({ kind: "reject", row: r })}>Reject</button>
          </div>
        ) : null,
    },
  ];

  const tabCls = (active: boolean) =>
    `${active ? "active" : ""} -mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-sans text-[13px] font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] ${
      active ? "border-[#0B3D32] text-[#0B3D32]" : "border-transparent text-[#6B756F] hover:text-[#0B3D32]"
    }`;
  const pillCls = (active: boolean, gold?: boolean) =>
    `grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 font-sans text-[10px] font-bold leading-none ${
      active ? "bg-[#0B3D32] text-white" : gold ? "bg-[#B98A4A] text-white" : "bg-[#DCE5D7] text-[#0B3D32]"
    }`;

  const pendingCount = count("Pending");

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
              Borrow Requests
            </h1>
          </div>
          {pendingCount > 0 && (
            <div className="inline-flex items-center gap-3 self-start rounded-[14px] border border-[#6F9B78] bg-[#F5F3EA] px-5 py-3 sm:self-auto">
              <b className="font-serif text-[32px] font-medium leading-none text-[#0B3D32]">{pendingCount}</b>
              <span className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B756F]">Awaiting review</span>
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs mt-6 flex gap-2 overflow-x-auto border-b border-[#D9DDD7]">
        <button className={tabCls(filter === "Pending")} onClick={() => setFilter("Pending")}>
          Pending <b className={pillCls(filter === "Pending", true)}>{count("Pending")}</b>
        </button>
        <button className={tabCls(filter === "Approved")} onClick={() => setFilter("Approved")}>
          Approved <b className={pillCls(filter === "Approved")}>{count("Approved")}</b>
        </button>
        <button className={tabCls(filter === "all")} onClick={() => setFilter("all")}>
          All history
        </button>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-[16px] border border-[#D9DDD7] bg-[#FBFAF5] p-1 shadow-[0_4px_14px_rgba(11,61,50,0.05)]">
        <DataTable columns={columns} rows={shown} empty="No requests here." />
      </div>

      {action?.kind === "approve" && (
        <ConfirmDialog title="Approve this request?" confirmLabel="Approve" busy={busy} onConfirm={confirm} onClose={close}>
          <p className="font-sans text-[14px] text-[#1F2A27]">
            {action.row.student} requested “<span className="font-serif text-[#0B3D32]">{action.row.book}</span>”.
          </p>
          <p className="muted mt-2 font-sans text-[13px] leading-relaxed text-[#6B756F]">
            Approving holds a copy for pickup. The book counts as borrowed only after you issue it on the Issue page.
          </p>
        </ConfirmDialog>
      )}
      {action?.kind === "reject" && (
        <ConfirmDialog title="Reject this request" confirmLabel="Reject" danger busy={busy} confirmDisabled={!reason.trim()} onConfirm={confirm} onClose={close}>
          <p className="font-sans text-[14px] text-[#1F2A27]">
            {action.row.student} requested “<span className="font-serif text-[#0B3D32]">{action.row.book}</span>”.
          </p>
          <label className="field mt-4 flex flex-col gap-1.5">
            <span className="font-sans text-[11px] font-bold tracking-[0.03em] text-[#0B3D32]">Reason (shown to the student)</span>
            <input
              className="h-11 w-full rounded-[10px] border border-[#D9DDD7] bg-[#F5F3EA] px-3.5 font-sans text-[13.5px] text-[#1F2A27] transition-all duration-200 focus:border-[#6F9B78] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6F9B78]/40"
              value={reason}
              maxLength={255}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </ConfirmDialog>
      )}
    </div>
  );
}