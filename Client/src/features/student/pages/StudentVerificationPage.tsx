import { useState } from "react";
import { Link } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as verificationService from "@/services/verificationService";
import type { CorVerification } from "@/types";
import { formatDate } from "@/utils/formatDate";
import CORStatusCard from "../components/CORStatusCard";

export default function StudentVerificationPage() {
  const summary = useAsync(() => verificationService.getMyCorSummary(), []);
  const history = useAsync(() => verificationService.listMyVerifications(), []);
  const [docModal, setDocModal] = useState<{ url: string | null; note?: string; name: string } | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  const viewDoc = async (c: CorVerification) => {
    setLoadingDocId(c.id);
    try {
      const info = await verificationService.getMyCorDocumentInfo(c.id);
      if (info.simulated) {
        setDocModal({ url: null, note: `${info.fileName}: Demo mode (simulated document).`, name: c.termName });
      } else if (info.url) {
        setDocModal({ url: info.url, name: c.termName });
      }
    } catch {
      setDocModal({ url: null, note: "Could not load document preview.", name: c.termName });
    } finally {
      setLoadingDocId(null);
    }
  };

  const columns: Column<CorVerification>[] = [
    { key: "termName", header: "Term" },
    { key: "originalFileName", header: "File" },
    { key: "submittedAt", header: "Submitted", render: (c) => formatDate(c.submittedAt) },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
    { key: "validity", header: "Valid", render: (c) => (c.effectiveFrom && c.validUntil ? `${formatDate(c.effectiveFrom)} – ${formatDate(c.validUntil)}` : "—") },
    { key: "rejectionReason", header: "Reason", render: (c) => c.rejectionReason ?? "—" },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <Button size="sm" variant="ghost" onClick={() => void viewDoc(c)} loading={loadingDocId === c.id}>
          View photo
        </Button>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHero eyebrow="Account" title="Certificate of Registration" description="A COR is submitted once per academic term and reviewed by authorized staff." leading={<BackButton fallback={ROUTES.student.dashboard} />} actions={<Link to={ROUTES.student.uploadCor} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }}>Upload COR</Link>} />
      <div className="stack">
        <Alert kind="info">An expired or unapproved COR blocks only new borrowing, reservations and renewals. Your existing loans and due dates are not changed.</Alert>
        {summary.loading ? <LoadingState rows={2} /> : summary.error || !summary.data ? <ErrorState message={summary.error ?? ""} onRetry={() => void summary.reload()} /> : <CORStatusCard cor={summary.data} />}
        <h2>Submission history</h2>
        {history.loading ? <LoadingState rows={3} /> : history.error ? <ErrorState message={history.error} onRetry={() => void history.reload()} /> : (
          <div className="card"><DataTable columns={columns} rows={history.data ?? []} rowKey={(c) => c.id} empty="No COR submitted yet." /></div>
        )}
      </div>

      {docModal && (
        <Modal
          title={`COR Photo · ${docModal.name}`}
          wide
          onClose={() => {
            if (docModal.url) URL.revokeObjectURL(docModal.url);
            setDocModal(null);
          }}
          footer={
            <Button variant="ghost" onClick={() => {
              if (docModal.url) URL.revokeObjectURL(docModal.url);
              setDocModal(null);
            }}>
              Close
            </Button>
          }
        >
          {docModal.note && <Alert kind="info">{docModal.note}</Alert>}
          {docModal.url && (
            <div
              style={{
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid var(--color-line, #e2e8f0)",
                backgroundColor: "#000",
                maxHeight: 520,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <img
                src={docModal.url}
                alt="Submitted Certificate of Registration"
                style={{ maxWidth: "100%", maxHeight: 520, objectFit: "contain" }}
              />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}