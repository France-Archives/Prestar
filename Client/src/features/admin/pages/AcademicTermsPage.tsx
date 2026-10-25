import { useState } from "react";
import Button from "@/components/common/Button";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHero from "@/components/layout/PageHero";
import Alert from "@/components/feedback/Alert";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as adminService from "@/services/adminService";
import type { AcademicTerm } from "@/types";
import { formatDate } from "@/utils/formatDate";
import AcademicTermForm from "../components/AcademicTermForm";
import { USE_MOCKS } from "@/utils/constants";

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
    ...(USE_MOCKS ? [{ key: "actions", header: "", render: (t: AcademicTerm) => <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>Edit</Button> }] : []),
  ];

  return (
    <div className="page">
      <PageHero eyebrow="System" title="Academic terms" description={USE_MOCKS ? "Configure term dates and COR deadlines. Approved CORs are valid from the term start to the term end." : "Review academic terms and their COR deadlines."} leading={<BackButton fallback={ROUTES.admin.dashboard} />} compact actions={USE_MOCKS ? <Button onClick={() => setEditing("new")}>Add term</Button> : undefined} />
      {!USE_MOCKS && <Alert kind="info">Terms are read-only. Add, edit, and status changes are not available yet.</Alert>}
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