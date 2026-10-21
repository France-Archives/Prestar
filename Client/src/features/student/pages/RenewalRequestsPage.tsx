import { Link } from "react-router-dom";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import StatusBadge from "@/components/data-display/StatusBadge";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { matchesSearch, useSearchTerm } from "@/hooks/useSearchTerm";
import * as renewalsService from "@/services/renewalsService";
import { USE_MOCKS } from "@/utils/constants";
import Alert from "@/components/feedback/Alert";
import type { RenewalView } from "@/types";
import { statusLabel } from "@/utils/constants";
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
  const list = useAsync(
    () => USE_MOCKS ? renewalsService.listMyRenewals() : Promise.resolve(null),
    [],
  );
  const [q] = useSearchTerm(); // from the navbar search box (?q=)

  // Search runs on the loaded renewal records (book, result, reason).
  const rows = (list.data ?? []).filter((r) => matchesSearch(q, r.bookTitle, statusLabel(r.status), r.decisionReason));

  return (
    <div className="page">
      <PageHero eyebrow="Student" title="Renewal history" description="Renewals are approved automatically when you are eligible and nobody is waiting for the title. The new due date counts from the approval date." leading={<BackButton fallback={ROUTES.student.dashboard} />} actions={USE_MOCKS ? <Link to={ROUTES.student.borrowings} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }}>Renew a loan</Link> : undefined} />
      {!USE_MOCKS ? (
        <Alert kind="info">Renewal history and renewal requests are not available from the live Server API yet.</Alert>
      ) : list.loading ? (
        <LoadingState rows={3} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="card">
          <DataTable columns={COLUMNS} rows={rows} rowKey={(r) => r.id} empty={q.trim() ? "No renewals match your search." : "No renewals yet."} />
        </div>
      )}
    </div>
  );
}