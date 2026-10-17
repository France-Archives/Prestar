import { useState } from "react";
import Alert, { MockTag } from "@/components/feedback/Alert";
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

// COR review needs Admin or a Librarian with the COR_REVIEW permission (enforced by the backend).
export default function CORReviewPanel({ item, onClose, onDone }: CORReviewPanelProps) {
  const toast = useToast();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [docNote, setDocNote] = useState<string | null>(null);
  const pending = item.status === "PENDING";

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
    try {
      const info = await verificationService.getCorDocumentInfo(item.id);
      setDocNote(`${info.fileName}: the file is not stored in this demo. The real backend streams it from private storage to authorized reviewers only.`);
    } catch (e) {
      setError(describeError(e));
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
        <div><dt>Student number</dt><dd>{item.student.studentNumber}</dd></div>
        <div><dt>Term</dt><dd>{item.termName}</dd></div>
        <div><dt>Status</dt><dd><StatusBadge status={item.status} /></dd></div>
        <div><dt>Submitted</dt><dd>{formatDate(item.submittedAt)}</dd></div>
        <div><dt>File</dt><dd>{item.originalFileName}</dd></div>
        {item.effectiveFrom && item.validUntil && (
          <div><dt>Valid</dt><dd>{formatDate(item.effectiveFrom)} – {formatDate(item.validUntil)}</dd></div>
        )}
        {item.rejectionReason && <div><dt>Rejection reason</dt><dd>{item.rejectionReason}</dd></div>}
      </dl>
      <div>
        <Button variant="ghost" size="sm" onClick={openDocument}>
          View document
        </Button>{" "}
        <MockTag>Simulated</MockTag>
      </div>
      {docNote && <Alert kind="warn">{docNote}</Alert>}
      {pending && rejecting && <TextareaField label="Reason for rejection (shown to the student)" value={reason} onChange={(e) => setReason(e.target.value)} required />}
      {error && <Alert kind="error">{error}</Alert>}
    </Modal>
  );
}