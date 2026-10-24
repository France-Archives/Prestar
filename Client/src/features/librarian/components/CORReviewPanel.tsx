import { useEffect, useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { TextareaField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/data-display/StatusBadge";
import { useToast } from "@/hooks/useToast";
import * as verificationService from "@/services/verificationService";
import type { StaffCorVerification } from "@/types";
import { describeError } from "@/utils/errors";
import { formatDate } from "@/utils/formatDate";

interface CORReviewPanelProps {
  item: StaffCorVerification;
  onClose: () => void;
  onDone: () => void;
}

// COR review is available to Admins and Librarians (the backend enforces access).
export default function CORReviewPanel({ item, onClose, onDone }: CORReviewPanelProps) {
  const toast = useToast();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const pending = item.status === "PENDING";

  useEffect(() => () => {
    if (documentUrl) URL.revokeObjectURL(documentUrl);
  }, [documentUrl]);

  const run = async (kind: "approve" | "reject") => {
    if (kind === "reject" && !reason.trim()) return setError("A reason is required to reject a COR.");
    setBusy(kind);
    setError(null);
    try {
      if (kind === "approve") await verificationService.approveCor(item.id);
      else await verificationService.rejectCor(item.id, { reason: reason.trim() });
      toast.success(kind === "approve" ? "COR approved." : "COR rejected. The student can resubmit.");
      onDone();
      onClose();
    } catch (e) {
      setError(describeError(e));
      setBusy(null);
    }
  };

  const openDocument = async () => {
    setDocumentLoading(true);
    setError(null);
    try {
      const document = await verificationService.getCorDocument(item.id);
      setDocumentUrl(URL.createObjectURL(document));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setDocumentLoading(false);
    }
  };

  return (
    <Modal
      title="Review COR"
      wide
      onClose={busy ? () => undefined : onClose}
      footer={
        pending ? (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy !== null}>
              Close
            </Button>
            {!rejecting ? (
              <Button variant="danger" onClick={() => setRejecting(true)} disabled={busy !== null}>
                Reject…
              </Button>
            ) : (
              <Button variant="danger" onClick={() => run("reject")} loading={busy === "reject"}>
                Confirm rejection
              </Button>
            )}
            <Button onClick={() => run("approve")} loading={busy === "approve"} disabled={rejecting}>
              Approve
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <dl className="kv">
        <div><dt>Student</dt><dd>{item.student.name}</dd></div>
        <div><dt>Student number</dt><dd>{item.student.studentNumber || "Not provided by Server"}</dd></div>
        <div><dt>Term</dt><dd>{item.termName}</dd></div>
        <div><dt>Status</dt><dd><StatusBadge status={item.status} /></dd></div>
        <div><dt>Submitted</dt><dd>{formatDate(item.submittedAt)}</dd></div>
        <div><dt>File</dt><dd>{item.originalFileName || "Not provided by Server"}</dd></div>
        {item.effectiveFrom && item.validUntil && (
          <div><dt>Valid</dt><dd>{formatDate(item.effectiveFrom)} – {formatDate(item.validUntil)}</dd></div>
        )}
        {item.rejectionReason && <div><dt>Rejection reason</dt><dd>{item.rejectionReason}</dd></div>}
      </dl>
      <div>
        <Button variant="ghost" size="sm" onClick={openDocument} loading={documentLoading}>Load document</Button>
        {documentUrl && (
          <a className="btn btn-ghost btn-sm" href={documentUrl} target="_blank" rel="noreferrer">
            Open document
          </a>
        )}
      </div>
      {pending && rejecting && <TextareaField label="Reason for rejection (shown to the student)" value={reason} onChange={(e) => setReason(e.target.value)} required />}
      {error && <Alert kind="error">{error}</Alert>}
    </Modal>
  );
}