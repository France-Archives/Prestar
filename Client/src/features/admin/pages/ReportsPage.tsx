import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Money from "@/components/data-display/Money";
import StatusBadge from "@/components/data-display/StatusBadge";
import Tabs from "@/components/ui/Tabs";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import * as reportsService from "@/services/reportsService";
import type { BorrowingReportRow, FinesReportRow, OverdueReportRow } from "@/types";
import { statusLabel } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";
import ReportsFilters from "../components/ReportsFilters";

type Tab = "borrowing" | "overdue" | "fines";

const BORROWING: Column<BorrowingReportRow>[] = [
  { key: "studentName", header: "Student", render: (r) => `${r.studentName} (${r.studentNumber})` },
  { key: "bookTitle", header: "Book" },
  { key: "borrowedAt", header: "Borrowed", render: (r) => formatDate(r.borrowedAt) },
  { key: "dueAt", header: "Due", render: (r) => formatDate(r.dueAt) },
  { key: "returnedAt", header: "Returned", render: (r) => (r.returnedAt ? formatDate(r.returnedAt) : "—") },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
];
const OVERDUE: Column<OverdueReportRow>[] = [
  { key: "studentName", header: "Student", render: (r) => `${r.studentName} (${r.studentNumber})` },
  { key: "bookTitle", header: "Book" },
  { key: "dueAt", header: "Due", render: (r) => formatDate(r.dueAt) },
  { key: "overdueDays", header: "Days overdue" },
  { key: "restricted", header: "Restricted", render: (r) => (r.overdueDays > 3 ? "Yes" : "Grace period") },
];
const FINES: Column<FinesReportRow>[] = [
  { key: "studentName", header: "Student", render: (r) => `${r.studentName} (${r.studentNumber})` },
  { key: "fineType", header: "Type", render: (r) => statusLabel(r.fineType) },
  { key: "amount", header: "Amount", render: (r) => <Money value={r.amount} /> },
  { key: "paidAmount", header: "Paid", render: (r) => <Money value={r.paidAmount} /> },
  { key: "balance", header: "Balance", render: (r) => <Money value={r.balance} /> },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "recordedAt", header: "Recorded", render: (r) => formatDate(r.recordedAt) },
];

// D2 to D4: the three reports defined in the source.
export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("borrowing");
  const [range, setRange] = useState({ from: "", to: "" });
  const filters = { from: range.from || undefined, to: range.to || undefined };
  const borrowing = useAsync(() => reportsService.getBorrowingReport(filters), [range.from, range.to]);
  const overdue = useAsync(() => reportsService.getOverdueReport(filters), [range.from, range.to]);
  const fines = useAsync(() => reportsService.getFinesReport(filters), [range.from, range.to]);

  const state = tab === "borrowing" ? borrowing : tab === "overdue" ? overdue : fines;

  return (
    <div className="page">
      <PageHeader eyebrow="Administration" title="Reports" description="Borrowing, overdue and fines reports for the selected period." />
      <Alert kind="info">Reports are computed live from the demo records. KPI definitions are TO CONFIRM (TC-16).</Alert>
      <Tabs<Tab>
        tabs={[
          { key: "borrowing", label: "Borrowing", count: borrowing.data?.length },
          { key: "overdue", label: "Overdue", count: overdue.data?.length },
          { key: "fines", label: "Fines", count: fines.data?.length },
        ]}
        active={tab}
        onChange={setTab}
      />
      <ReportsFilters from={range.from} to={range.to} onChange={setRange} />
      {state.loading && !state.data ? (
        <LoadingState rows={4} />
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={() => void state.reload()} />
      ) : (
        <div className="card">
          {tab === "borrowing" && <DataTable columns={BORROWING} rows={borrowing.data ?? []} rowKey={(r) => r.loanId} empty="No loans in this period." />}
          {tab === "overdue" && <DataTable columns={OVERDUE} rows={overdue.data ?? []} rowKey={(r) => r.loanId} empty="No overdue loans." />}
          {tab === "fines" && <DataTable columns={FINES} rows={fines.data ?? []} rowKey={(r) => r.fineId} empty="No fines in this period." />}
        </div>
      )}
    </div>
  );
}