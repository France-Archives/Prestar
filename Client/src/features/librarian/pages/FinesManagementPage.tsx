import { useState } from "react";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Money from "@/components/data-display/Money";
import SearchInput from "@/components/forms/SearchInput";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import * as finesService from "@/services/finesService";
import * as librarianService from "@/services/librarianService";
import type { FineStatus, StaffFine } from "@/types";
import { statusLabel } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";
import { can } from "@/utils/permissions";
import FineAssessmentForm from "../components/FineAssessmentForm";
import PaymentForm from "../components/PaymentForm";

const STATUSES: FineStatus[] = ["UNPAID", "PARTIALLY_PAID", "PAID", "WAIVED"];
type Dialog = { kind: "pay" | "waive"; fine: StaffFine } | { kind: "assess" } | null;

// Fines are ₱100 (minor), ₱200 (major) and ₱500 (lost). No daily overdue fine. Students have no Fines page: they get notices.
// Viewing is a staff capability; assessing and recording payments need FINE_PAYMENT (Admin always); waiving is Admin only.
export default function FinesManagementPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | FineStatus>("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const list = useAsync(() => finesService.listFines({ status: status || undefined, search: search || undefined }), [status, search]);
  const loans = useAsync(() => librarianService.listStaffLoans(), []);

  const canManage = user ? can(user, "FINE_MANAGE") : false;
  const canWaive = user ? can(user, "FINE_WAIVE") : false;

  const columns: Column<StaffFine>[] = [
    { key: "student", header: "Student", render: (f) => `${f.student.firstName} ${f.student.lastName} (${f.student.studentNumber})` },
    { key: "bookTitle", header: "Book" },
    { key: "fineType", header: "Type", render: (f) => statusLabel(f.fineType) },
    { key: "amount", header: "Amount", render: (f) => <Money value={f.amount} /> },
    { key: "paidAmount", header: "Paid", render: (f) => <Money value={f.paidAmount} /> },
    { key: "balance", header: "Balance", render: (f) => <Money value={f.balance} /> },
    { key: "status", header: "Status", render: (f) => <StatusBadge status={f.status} /> },
    { key: "recordedAt", header: "Recorded", render: (f) => formatDate(f.recordedAt) },
    {
      key: "actions",
      header: "",
      render: (f) => {
        const open = f.status === "UNPAID" || f.status === "PARTIALLY_PAID";
        if (!open) return null;
        return (
          <div className="row-actions">
            {canManage && (
              <Button size="sm" onClick={() => setDialog({ kind: "pay", fine: f })}>
                Record payment
              </Button>
            )}
            {canWaive && (
              <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "waive", fine: f })}>
                Waive
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Fines"
        title="Fines"
        description="Damage and lost-book fines. Unpaid balances block new borrowing and reservations."
        actions={canManage ? <Button onClick={() => setDialog({ kind: "assess" })}>Assess a fine</Button> : undefined}
      />
      {!canManage && <p className="subtle" style={{ marginBottom: 10 }}>You can view fines. Assessing fines and recording payments needs the fine/payment permission from an Admin.</p>}
      <div className="toolbar" style={{ marginTop: 0 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search student, number or book…" />
        <select className="select" style={{ width: "auto" }} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as "" | FineStatus)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>
      {list.loading ? (
        <LoadingState rows={4} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="card">
          <DataTable columns={columns} rows={list.data ?? []} rowKey={(f) => f.id} empty="No fines match." />
        </div>
      )}
      {dialog?.kind === "assess" && <FineAssessmentForm loans={loans.data ?? []} onClose={() => setDialog(null)} onDone={() => void list.reload()} />}
      {dialog?.kind === "pay" && <PaymentForm fine={dialog.fine} onClose={() => setDialog(null)} onDone={() => void list.reload()} />}
      {dialog?.kind === "waive" && (
        <ConfirmDialog
          title="Waive this fine?"
          danger
          confirmLabel="Waive fine"
          reasonLabel="Reason (kept in the audit log)"
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            await finesService.waiveFine(dialog.fine.id, { reason });
            toast.success("Fine waived.");
            await list.reload();
          }}
        >
          <p>
            {statusLabel(dialog.fine.fineType)} for {dialog.fine.student.firstName} {dialog.fine.student.lastName}, balance <Money value={dialog.fine.balance} />. Waiving is exceptional, Admin only and cannot be undone here.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}