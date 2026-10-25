import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Money from "@/components/data-display/Money";
import Pagination from "@/components/data-display/Pagination";
import SearchInput from "@/components/forms/SearchInput";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/hooks/useAuth";
import * as finesService from "@/services/finesService";
import type { StaffFine, StaffPayment } from "@/types";
import { statusLabel, USE_MOCKS } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";
import { can } from "@/utils/permissions";
import PaymentForm from "../components/PaymentForm";

const PAGE_SIZE = 15;

export default function PaymentRecordingPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const fineId = searchParams.get("fineId");
  const [fineSearch, setFineSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const deferredFineSearch = useDebounce(fineSearch);
  const deferredPaymentSearch = useDebounce(paymentSearch);
  const [finePage, setFinePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [target, setTarget] = useState<StaffFine | null>(null);
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const canManage = user ? can(user, "FINE_MANAGE") : false;
  const fines = useAsync(() => finesService.listFinesPage({
    status: USE_MOCKS ? undefined : "UNPAID",
    search: deferredFineSearch || undefined,
    page: finePage,
    pageSize: PAGE_SIZE,
  }), [deferredFineSearch, finePage]);
  const payments = useAsync(() => finesService.listPaymentsPage({
    search: deferredPaymentSearch || undefined,
    page: paymentPage,
    pageSize: PAGE_SIZE,
  }), [deferredPaymentSearch, paymentPage]);
  const selected = useAsync(() => fineId ? finesService.getUnpaidFineById(fineId) : Promise.resolve(null), [fineId], Boolean(fineId));

  const outstanding = (fines.data?.data ?? []).filter((fine) => fine.status === "UNPAID" || (USE_MOCKS && fine.status === "PARTIALLY_PAID"));

  useEffect(() => {
    if (!fineId) {
      setTarget(null);
      setSelectedError(null);
      return;
    }
    if (selected.loading) return;
    if (selected.error) {
      setSelectedError(selected.error);
      return;
    }
    if (!selected.data) {
      setSelectedError("That fine is no longer unpaid or could not be found.");
      return;
    }
    setSelectedError(null);
    setTarget(selected.data);
  }, [fineId, selected.data, selected.error, selected.loading]);

  const fineColumns: Column<StaffFine>[] = [
    { key: "student", header: "Student", render: (fine) => `${fine.student.firstName} ${fine.student.lastName} (${fine.student.studentNumber})` },
    { key: "fineType", header: "Fine", render: (fine) => fine.fineTypeLabel ?? statusLabel(fine.fineType) },
    { key: "bookTitle", header: "Book" },
    { key: "amount", header: "Amount", render: (fine) => <Money value={fine.amount} /> },
    { key: "status", header: "Status", render: (fine) => statusLabel(fine.status) },
    {
      key: "actions",
      header: "",
      render: (fine) => canManage ? <Button size="sm" onClick={() => setTarget(fine)}>Select</Button> : null,
    },
  ];
  const paymentColumns: Column<StaffPayment>[] = [
    { key: "receiptNo", header: "Receipt no.", render: (payment) => payment.receiptNo ?? payment.referenceNumber ?? "—" },
    { key: "amount", header: "Amount", render: (payment) => <Money value={payment.amount} /> },
    { key: "student", header: "Student", render: (payment) => `${payment.student.firstName} ${payment.student.lastName} (${payment.student.studentNumber})` },
    { key: "bookTitle", header: "Book", render: (payment) => payment.bookTitle ?? "—" },
    { key: "recordedByName", header: "Received by", render: (payment) => payment.recordedByName ?? "—" },
    { key: "paidAt", header: "Date", render: (payment) => formatDate(payment.paidAt) },
  ];
  const fineMeta = fines.data?.meta;
  const paymentMeta = payments.data?.meta;
  const fineTotalPages = fineMeta ? Math.max(1, Math.ceil(fineMeta.total / fineMeta.pageSize)) : 1;
  const paymentTotalPages = paymentMeta ? Math.max(1, Math.ceil(paymentMeta.total / paymentMeta.pageSize)) : 1;
  const reloadAll = () => {
    void fines.reload();
    void payments.reload();
    if (fineId) void selected.reload();
  };
  const closeTarget = () => {
    setTarget(null);
    if (fineId) {
      const next = new URLSearchParams(searchParams);
      next.delete("fineId");
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <div className="page">
      <PageHero
        eyebrow="Payments"
        title="Payment recording"
        description="Record full cash payments received at the library and review the receipt history."
        leading={<BackButton fallback={user?.role === "ADMIN" ? ROUTES.admin.dashboard : ROUTES.staff.dashboard} />}
        compact
      />
      {!canManage && <Alert kind="warn">Read-only access. Recording payments requires the FINE_MANAGE capability.</Alert>}
      <div className="stack">
        <section className="card">
          <div className="card__header"><h2>Record payment</h2></div>
          {!USE_MOCKS && <Alert kind="info">Cash only, full payment. No partial payments are accepted.</Alert>}
          {selected.loading && fineId && <LoadingState rows={1} />}
          {selectedError && <Alert kind="error">{selectedError}</Alert>}
          {target ? (
            <div className="stack">
              <p><strong>{target.student.firstName} {target.student.lastName}</strong> · {target.bookTitle} · {target.fineTypeLabel ?? statusLabel(target.fineType)}</p>
              {canManage ? <PaymentForm fine={target} onClose={closeTarget} onDone={reloadAll} /> : null}
            </div>
          ) : canManage ? (
            <>
              <SearchInput value={fineSearch} onChange={(value) => { setFineSearch(value); setFinePage(1); }} placeholder="Search unpaid fines by student, book or receipt…" />
              {fines.loading && !fines.data ? <LoadingState rows={2} /> : fines.error ? <ErrorState message={fines.error} onRetry={() => void fines.reload()} /> : (
                <>
                  <DataTable columns={fineColumns} rows={outstanding} rowKey={(fine) => fine.id} empty="No unpaid fines found." pageSize={PAGE_SIZE} />
                  {fineMeta && <Pagination
                    page={fineMeta.page}
                    totalPages={fineTotalPages}
                    from={fineMeta.total ? (fineMeta.page - 1) * fineMeta.pageSize + 1 : 0}
                    to={Math.min(fineMeta.total, fineMeta.page * fineMeta.pageSize)}
                    total={fineMeta.total}
                    onPrev={() => setFinePage((current) => Math.max(1, current - 1))}
                    onNext={() => setFinePage((current) => Math.min(fineTotalPages, current + 1))}
                  />}
                </>
              )}
            </>
          ) : <p className="subtle">Select an unpaid fine to record its full cash payment.</p>}
        </section>
        <section className="card">
          <div className="card__header"><h2>Payment history</h2></div>
          <SearchInput value={paymentSearch} onChange={(value) => { setPaymentSearch(value); setPaymentPage(1); }} placeholder="Search receipt, student, book or receiver…" />
          {payments.loading && !payments.data ? <LoadingState rows={2} /> : payments.error ? <ErrorState message={payments.error} onRetry={() => void payments.reload()} /> : (
            <>
              <DataTable columns={paymentColumns} rows={payments.data?.data ?? []} rowKey={(payment) => payment.id} empty="No payments recorded yet." pageSize={PAGE_SIZE} />
              {paymentMeta && <Pagination
                page={paymentMeta.page}
                totalPages={paymentTotalPages}
                from={paymentMeta.total ? (paymentMeta.page - 1) * paymentMeta.pageSize + 1 : 0}
                to={Math.min(paymentMeta.total, paymentMeta.page * paymentMeta.pageSize)}
                total={paymentMeta.total}
                onPrev={() => setPaymentPage((current) => Math.max(1, current - 1))}
                onNext={() => setPaymentPage((current) => Math.min(paymentTotalPages, current + 1))}
              />}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
