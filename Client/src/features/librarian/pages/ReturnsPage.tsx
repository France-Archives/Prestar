import { useState } from "react";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import SearchInput from "@/components/forms/SearchInput";
import StatusBadge from "@/components/data-display/StatusBadge";
import Tabs from "@/components/ui/Tabs";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import * as librarianService from "@/services/librarianService";
import type { ReturnResult, StaffLoan } from "@/types";
import { formatDate } from "@/utils/formatDate";
import ReturnConditionForm from "../components/ReturnConditionForm";

type Tab = "active" | "overdue" | "closed";
type Dialog = { kind: "return" | "lost"; loan: StaffLoan } | null;

export default function ReturnsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("active");
  const [dialog, setDialog] = useState<Dialog>(null);
  const list = useAsync(() => librarianService.listStaffLoans({ search: search || undefined }), [search]);

  const all = list.data ?? [];
  const active = all.filter((l) => l.status === "ACTIVE");
  const overdue = active.filter((l) => l.overdueDays > 0);
  const closed = all.filter((l) => l.status !== "ACTIVE");
  const rows = tab === "active" ? active : tab === "overdue" ? overdue : closed;

  const onReturned = (r: ReturnResult) => {
    const where =
      r.offeredToReservationId !== null
        ? "The copy was offered to the next student in the queue."
        : r.copyStatus === "AVAILABLE"
          ? "The copy is back on the shelf."
          : r.copyStatus === "MAINTENANCE"
            ? "The copy was sent to maintenance."
            : "The copy was withdrawn.";
    toast.success(`Return recorded. ${where}`);
    void list.reload();
  };

  const columns: Column<StaffLoan>[] = [
    { key: "student", header: "Student", render: (l) => `${l.student.firstName} ${l.student.lastName} (${l.student.studentNumber})` },
    { key: "bookTitle", header: "Book" },
    { key: "copyBarcode", header: "Copy" },
    { key: "borrowedAt", header: "Borrowed", render: (l) => formatDate(l.borrowedAt) },
    { key: "dueAt", header: "Due", render: (l) => formatDate(l.dueAt) },
    { key: "overdueDays", header: "Overdue", render: (l) => (l.overdueDays > 0 ? `${l.overdueDays} days` : "—") },
    { key: "status", header: "Status", render: (l) => <StatusBadge status={l.status} /> },
    {
      key: "actions",
      header: "",
      render: (l) =>
        l.status === "ACTIVE" ? (
          <div className="row-actions">
            <Button size="sm" onClick={() => setDialog({ kind: "return", loan: l })}>
              Receive return
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "lost", loan: l })}>
              Mark lost
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="page">
      <PageHeader eyebrow="Circulation" title="Returns and loans" description="Confirm returns and record the copy condition. Returns are never blocked by overdue, fines or suspension. Overdue never becomes lost by itself." />
      <div className="toolbar" style={{ marginTop: 0 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search student, book or barcode…" />
      </div>
      <Tabs<Tab>
        tabs={[
          { key: "active", label: "Active loans", count: active.length },
          { key: "overdue", label: "Overdue", count: overdue.length },
          { key: "closed", label: "Closed", count: closed.length },
        ]}
        active={tab}
        onChange={setTab}
      />
      {list.loading ? (
        <LoadingState rows={4} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="card">
          <DataTable columns={columns} rows={rows} rowKey={(l) => l.id} empty="No loans here." />
        </div>
      )}
      {dialog?.kind === "return" && <ReturnConditionForm loan={dialog.loan} onClose={() => setDialog(null)} onDone={onReturned} />}
      {dialog?.kind === "lost" && (
        <ConfirmDialog
          title="Mark this loan lost?"
          danger
          confirmLabel="Mark lost"
          reasonLabel="Notes (confirm you spoke with the student)"
          onClose={() => setDialog(null)}
          onConfirm={async (notes) => {
            await librarianService.markLoanLost(dialog.loan.id, { notes });
            toast.success("Loan marked lost. A ₱500 lost-book fine was recorded.");
            await list.reload();
          }}
        >
          <p>
            {dialog.loan.bookTitle} · copy {dialog.loan.copyBarcode} · {dialog.loan.student.firstName} {dialog.loan.student.lastName}. Only mark a book lost after confirming with the student. The lost-book fine blocks new borrowing until it is fully paid.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}