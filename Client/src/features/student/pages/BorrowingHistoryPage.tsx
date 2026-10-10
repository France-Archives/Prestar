import DataTable, { type Column } from "@/components/data-display/DataTable";
import StatusBadge from "@/components/data-display/StatusBadge";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import { matchesSearch, useSearchTerm } from "@/hooks/useSearchTerm";
import * as borrowingService from "@/services/borrowingService";
import type { Loan } from "@/types";
import { statusLabel } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";

const COLUMNS: Column<Loan>[] = [
  { key: "bookTitle", header: "Book" },
  { key: "copyBarcode", header: "Copy" },
  { key: "borrowedAt", header: "Borrowed", render: (l) => formatDate(l.borrowedAt) },
  { key: "dueAt", header: "Due", render: (l) => formatDate(l.dueAt) },
  { key: "returnedAt", header: "Returned", render: (l) => (l.returnedAt ? formatDate(l.returnedAt) : "—") },
  { key: "renewedCount", header: "Renewals" },
  { key: "status", header: "Status", render: (l) => <StatusBadge status={l.status} /> },
];

export default function BorrowingHistoryPage() {
  const list = useAsync(() => borrowingService.getMyHistory(), []);
  const [q] = useSearchTerm(); // from the navbar search box (?q=)

  // Search runs on the loaded history (book, copy barcode, status).
  const rows = (list.data ?? []).filter((l) => matchesSearch(q, l.bookTitle, l.copyBarcode, statusLabel(l.status)));

  return (
    <div className="page">
      <PageHeader eyebrow="Student" title="Borrowing history" description="Returned and lost loans. History stays available even when your COR has expired or your account is suspended." />
      {list.loading ? (
        <LoadingState rows={3} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="card">
          <DataTable columns={COLUMNS} rows={rows} rowKey={(l) => l.id} empty={q.trim() ? "No past loans match your search." : "No past loans yet."} />
        </div>
      )}
    </div>
  );
}