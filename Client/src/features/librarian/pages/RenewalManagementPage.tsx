import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import SearchInput from "@/components/forms/SearchInput";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import * as renewalsService from "@/services/renewalsService";
import type { StaffRenewalView } from "@/types";
import { formatDate } from "@/utils/formatDate";

const COLUMNS: Column<StaffRenewalView>[] = [
  { key: "student", header: "Student", render: (r) => `${r.student.firstName} ${r.student.lastName} (${r.student.studentNumber})` },
  { key: "bookTitle", header: "Book" },
  { key: "requestedAt", header: "Requested", render: (r) => formatDate(r.requestedAt) },
  { key: "requestedDurationDays", header: "Duration", render: (r) => `${r.requestedDurationDays} days` },
  { key: "status", header: "Result", render: (r) => <StatusBadge status={r.status} /> },
  { key: "oldDueAt", header: "Old due", render: (r) => (r.oldDueAt ? formatDate(r.oldDueAt) : "—") },
  { key: "newDueAt", header: "New due", render: (r) => (r.newDueAt ? formatDate(r.newDueAt) : "—") },
  { key: "decisionReason", header: "Reason", render: (r) => r.decisionReason ?? "—" },
];

// Staff observe renewals. They are decided automatically (eligible, nobody waiting, renewal limit). A manual-review state is TO CONFIRM (TC-07).
export default function RenewalManagementPage() {
  const [search, setSearch] = useState("");
  const list = useAsync(() => renewalsService.listStaffRenewals({ search: search || undefined }), [search]);
  return (
    <div className="page">
      <PageHeader eyebrow="Circulation" title="Renewals" description="History of renewal decisions. The new due date counts from the approval date." />
      <Alert kind="info">Renewals are approved or rejected automatically by the system, so there is nothing to approve here.</Alert>
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search student or book…" />
      </div>
      {list.loading ? (
        <LoadingState rows={4} />
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