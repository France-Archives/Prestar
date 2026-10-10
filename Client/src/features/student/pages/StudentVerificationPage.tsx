import { Link } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as verificationService from "@/services/verificationService";
import type { CorVerification } from "@/types";
import { formatDate } from "@/utils/formatDate";
import CORStatusCard from "../components/CORStatusCard";

const COLUMNS: Column<CorVerification>[] = [
  { key: "termName", header: "Term" },
  { key: "originalFileName", header: "File" },
  { key: "submittedAt", header: "Submitted", render: (c) => formatDate(c.submittedAt) },
  { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
  { key: "validity", header: "Valid", render: (c) => (c.effectiveFrom && c.validUntil ? `${formatDate(c.effectiveFrom)} – ${formatDate(c.validUntil)}` : "—") },
  { key: "rejectionReason", header: "Reason", render: (c) => c.rejectionReason ?? "—" },
];

export default function StudentVerificationPage() {
  const summary = useAsync(() => verificationService.getMyCorSummary(), []);
  const history = useAsync(() => verificationService.listMyVerifications(), []);

  return (
    <div className="page">
      <PageHeader eyebrow="Account" title="Certificate of Registration" description="A COR is submitted once per academic term and reviewed by authorized staff." actions={<Link to={ROUTES.student.uploadCor} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }}>Upload COR</Link>} />
      <div className="stack">
        <Alert kind="info">An expired or unapproved COR blocks only new borrowing, reservations and renewals. Your existing loans and due dates are not changed.</Alert>
        {summary.loading ? <LoadingState rows={2} /> : summary.error || !summary.data ? <ErrorState message={summary.error ?? ""} onRetry={() => void summary.reload()} /> : <CORStatusCard cor={summary.data} />}
        <h2>Submission history</h2>
        {history.loading ? <LoadingState rows={3} /> : history.error ? <ErrorState message={history.error} onRetry={() => void history.reload()} /> : (
          <div className="card"><DataTable columns={COLUMNS} rows={history.data ?? []} rowKey={(c) => c.id} empty="No COR submitted yet." /></div>
        )}
      </div>
    </div>
  );
}