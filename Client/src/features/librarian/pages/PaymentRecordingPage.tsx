import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import Card from "@/components/ui/Card";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Money from "@/components/data-display/Money";
import SearchInput from "@/components/forms/SearchInput";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import * as finesService from "@/services/finesService";
import type { StaffFine, StaffPayment } from "@/types";
import { statusLabel } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";
import { can } from "@/utils/permissions";
import PaymentForm from "../components/PaymentForm";

// Payments are made in person and recorded by authorized staff only. No online payment exists.
export default function PaymentRecordingPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<StaffFine | null>(null);
  const fines = useAsync(() => finesService.listFines({ search: search || undefined }), [search]);
  const payments = useAsync(() => finesService.listPayments({ search: search || undefined }), [search]);
  const canManage = user ? can(user, "FINE_MANAGE") : false;

  const outstanding = (fines.data ?? []).filter((f) => f.status === "UNPAID" || f.status === "PARTIALLY_PAID");

  const fineColumns: Column<StaffFine>[] = [
    { key: "student", header: "Student", render: (f) => `${f.student.firstName} ${f.student.lastName} (${f.student.studentNumber})` },
    { key: "fineType", header: "Fine", render: (f) => statusLabel(f.fineType) },
    { key: "bookTitle", header: "Book" },
    { key: "balance", header: "Balance", render: (f) => <Money value={f.balance} /> },
    {
      key: "actions",
      header: "",
      render: (f) =>
        canManage ? (
          <Button size="sm" onClick={() => setTarget(f)}>
            Record payment
          </Button>
        ) : null,
    },
  ];

  const paymentColumns: Column<StaffPayment>[] = [
    { key: "paidAt", header: "Paid", render: (p) => formatDate(p.paidAt) },
    { key: "student", header: "Student", render: (p) => `${p.student.firstName} ${p.student.lastName} (${p.student.studentNumber})` },
    { key: "fineType", header: "Fine", render: (p) => statusLabel(p.fineType) },
    { key: "amount", header: "Amount", render: (p) => <Money value={p.amount} /> },
    { key: "paymentMethod", header: "Method", render: (p) => statusLabel(p.paymentMethod) },
    { key: "referenceNumber", header: "Reference", render: (p) => p.referenceNumber ?? "—" },
    { key: "recordedByName", header: "Recorded by" },
  ];

  const reloadAll = () => {
    void fines.reload();
    void payments.reload();
  };

  return (
    <div className="page">
      <PageHeader eyebrow="Fines" title="Payment recording" description="Record money received in person at the library desk, then review the payment history." />
      {!canManage && <Alert kind="warn">Recording payments needs the fine/payment permission. You can view the history.</Alert>}
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search student, number or reference…" />
      </div>
      <div className="stack">
        <Card title="Outstanding fines" padded={false}>
          {fines.loading ? <LoadingState rows={2} /> : fines.error ? <ErrorState message={fines.error} onRetry={() => void fines.reload()} /> : (
            <DataTable columns={fineColumns} rows={outstanding} rowKey={(f) => f.id} empty="No outstanding fines." pageSize={5} />
          )}
        </Card>
        <Card title="Payment history" padded={false}>
          {payments.loading ? <LoadingState rows={2} /> : payments.error ? <ErrorState message={payments.error} onRetry={() => void payments.reload()} /> : (
            <DataTable columns={paymentColumns} rows={payments.data ?? []} rowKey={(p) => p.id} empty="No payments recorded yet." />
          )}
        </Card>
      </div>
      {target && <PaymentForm fine={target} onClose={() => setTarget(null)} onDone={reloadAll} />}
    </div>
  );
}