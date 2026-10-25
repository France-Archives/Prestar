import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Money from "@/components/data-display/Money";
import Pagination from "@/components/data-display/Pagination";
import SearchInput from "@/components/forms/SearchInput";
import StatusBadge from "@/components/data-display/StatusBadge";
import Tabs from "@/components/ui/Tabs";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import Alert from "@/components/feedback/Alert";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import * as finesService from "@/services/finesService";
import type { StaffFine } from "@/types";
import { statusLabel, USE_MOCKS } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";
import { can } from "@/utils/permissions";
import FineAssessmentForm from "../components/FineAssessmentForm";
import * as librarianService from "@/services/librarianService";

const PAGE_SIZE = 15;
type Dialog = { kind: "waive"; fine: StaffFine } | { kind: "assess" } | null;
type FineFilter = "" | "UNPAID" | "PAID" | "WAIVED" | "PARTIALLY_PAID";

export default function FinesManagementPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [status, setStatus] = useState<FineFilter>("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog>(null);
  const loans = useAsync(() => librarianService.listStaffLoans(), [], USE_MOCKS);
  const list = useAsync(
    () => finesService.listFinesPage({ status: status || undefined, search: debouncedSearch || undefined, page, pageSize: PAGE_SIZE }),
    [status, debouncedSearch, page],
  );
  const canManage = user ? can(user, "FINE_MANAGE") : false;
  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  const columns: Column<StaffFine>[] = [
    { key: "student", header: "Student", render: (fine) => `${fine.student.firstName} ${fine.student.lastName} (${fine.student.studentNumber})` },
    { key: "bookTitle", header: "Book" },
    { key: "fineType", header: "Fine type", render: (fine) => fine.fineTypeLabel ?? statusLabel(fine.fineType) },
    { key: "amount", header: "Amount", render: (fine) => <Money value={fine.amount} /> },
    ...(!USE_MOCKS ? [] : [
      { key: "balance", header: "Balance", render: (fine: StaffFine) => <Money value={fine.balance} /> },
    ]),
    { key: "status", header: "Status", render: (fine) => <StatusBadge status={fine.status} /> },
    { key: "recordedAt", header: "Date", render: (fine) => formatDate(fine.recordedAt) },
    {
      key: "actions",
      header: "",
      render: (fine) => fine.status === "UNPAID" || (USE_MOCKS && fine.status === "PARTIALLY_PAID")
        ? <div className="row-actions">
            {canManage && <Link className="btn btn-ghost btn-sm" to={`${user?.role === "ADMIN" ? ROUTES.admin.payments : ROUTES.staff.payments}?fineId=${encodeURIComponent(fine.id)}`}>Record payment</Link>}
            {canManage && <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "waive", fine })}>Waive</Button>}
          </div>
        : null,
    },
  ];

  return (
    <div className="page">
      <PageHero
        eyebrow="Fines"
        title="Fines"
        description="Review assessed fines and waive eligible unpaid balances."
        leading={<BackButton fallback={user?.role === "ADMIN" ? ROUTES.admin.dashboard : ROUTES.staff.dashboard} />}
        compact
        actions={USE_MOCKS && canManage ? <Button onClick={() => setDialog({ kind: "assess" })}>Assess a fine</Button> : undefined}
      />
      {!USE_MOCKS && <Alert kind="info">Fines are created automatically when a book is returned damaged or marked lost.</Alert>}
      {!canManage && <Alert kind="info">Read-only access. Fine actions require the FINE_MANAGE capability.</Alert>}
      <div className="toolbar" style={{ marginTop: 0 }}>
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search student, number, book or receipt…" />
      </div>
      <Tabs<FineFilter>
        active={status}
        onChange={(value) => { setStatus(value); setPage(1); }}
        tabs={[
          { key: "", label: "All" },
          { key: "UNPAID", label: "Unpaid" },
          { key: "PAID", label: "Paid" },
          { key: "WAIVED", label: "Waived" },
          ...(USE_MOCKS ? [{ key: "PARTIALLY_PAID" as const, label: "Partially paid" }] : []),
        ]}
      />
      {list.loading && !list.data ? <LoadingState rows={4} /> : list.error ? <ErrorState message={list.error} onRetry={() => void list.reload()} /> : (
        <div className="card">
          <DataTable columns={columns} rows={rows} rowKey={(fine) => fine.id} empty="No fines match." pageSize={PAGE_SIZE} />
          {meta && <Pagination
            page={meta.page}
            totalPages={totalPages}
            from={meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1}
            to={Math.min(meta.total, meta.page * meta.pageSize)}
            total={meta.total}
            onPrev={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
          />}
        </div>
      )}
      {dialog?.kind === "assess" && <FineAssessmentForm loans={loans.data ?? []} onClose={() => setDialog(null)} onDone={() => void list.reload()} />}
      {dialog?.kind === "waive" && <ConfirmDialog
        title={`Waive ${dialog.fine.fineTypeLabel ?? statusLabel(dialog.fine.fineType)} for ${dialog.fine.student.firstName} ${dialog.fine.student.lastName}?`}
        message={`The balance of ₱${dialog.fine.balance.toFixed(2)} will be waived.`}
        details={[
          { label: "Student", value: `${dialog.fine.student.firstName} ${dialog.fine.student.lastName}` },
          { label: "Fine", value: dialog.fine.fineTypeLabel ?? statusLabel(dialog.fine.fineType) },
          { label: "Amount", value: <Money value={dialog.fine.amount} /> },
        ]}
        variant="destructive"
        confirmLabel="Waive fine"
        reasonLabel="Reason (required and audited)"
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await finesService.waiveFine(dialog.fine.id, { reason });
          toast.success("Fine waived.");
          await list.reload();
        }}
      />}
    </div>
  );
}
