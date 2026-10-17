import { useState } from "react";
import Button from "@/components/common/Button";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import * as adminService from "@/services/adminService";
import type { AcademicTerm } from "@/types";
import { formatDate } from "@/utils/formatDate";
import AcademicTermForm from "../components/AcademicTermForm";

// D9 to D11. Term dates and COR deadlines are configured here. A COR is effective only for its own term.
export default function AcademicTermsPage() {
  const list = useAsync(() => adminService.listAcademicTerms(), []);
  const [editing, setEditing] = useState<AcademicTerm | "new" | null>(null);

  const columns: Column<AcademicTerm>[] = [
    { key: "name", header: "Term", render: (t) => <b>{t.name}</b> },
    { key: "startDate", header: "Start", render: (t) => formatDate(t.startDate) },
    { key: "endDate", header: "End", render: (t) => formatDate(t.endDate) },
    { key: "corDeadline", header: "COR deadline", render: (t) => formatDate(t.corDeadline) },
    { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
    { key: "actions", header: "", render: (t) => <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>Edit</Button> },
  ];

  return (
    <div className="page">
      <PageHeader eyebrow="System" title="Academic terms" description="Configure term dates and COR deadlines. Approved CORs are valid from the term start to the term end." actions={<Button onClick={() => setEditing("new")}>Add term</Button>} />
      {list.loading && !list.data ? (
        <LoadingState rows={3} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="card"><DataTable columns={columns} rows={list.data ?? []} rowKey={(t) => t.id} empty="No terms configured." /></div>
      )}
      {editing && <AcademicTermForm term={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={() => void list.reload()} />}
    </div>
  );
}