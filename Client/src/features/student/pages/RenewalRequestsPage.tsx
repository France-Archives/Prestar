import { Link } from "react-router-dom";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as renewalsService from "@/services/renewalsService";
import type { RenewalView } from "@/types";
import { formatDate } from "@/utils/formatDate";

const COLUMNS: Column<RenewalView>[] = [
  { key: "bookTitle", header: "Book" },
  { key: "requestedAt", header: "Requested", render: (r) => formatDate(r.requestedAt) },
  { key: "requestedDurationDays", header: "Duration", render: (r) => `${r.requestedDurationDays} days` },
  { key: "status", header: "Result", render: (r) => <StatusBadge status={r.status} /> },
  { key: "oldDueAt", header: "Old due date", render: (r) => (r.oldDueAt ? formatDate(r.oldDueAt) : "—") },
  { key: "newDueAt", header: "New due date", render: (r) => (r.newDueAt ? formatDate(r.newDueAt) : "—") },
  { key: "decisionReason", header: "Reason", render: (r) => r.decisionReason ?? "—" },
];

// Renewals are decided automatically. To renew, use "Renew" on an active loan.
export default function RenewalRequestsPage() {
  const list = useAsync(() => renewalsService.listMyRenewals(), []);
  return (
    <div className="page">
      <PageHeader eyebrow="Student" title="Renewal history" description="Renewals are approved automatically when you are eligible and nobody is waiting for the title. The new due date counts from the approval date." actions={<Link to={ROUTES.student.borrowings} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }}>Renew a loan</Link>} />
      {list.loading ? (
        <LoadingState rows={3} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="card">
          <DataTable columns={COLUMNS} rows={list.data ?? []} rowKey={(r) => r.id} empty="No renewals yet." />
        </div>
      )}
    </div>
  );
}