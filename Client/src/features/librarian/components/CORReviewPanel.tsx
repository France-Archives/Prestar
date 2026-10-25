import { useEffect, useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import { SelectField, TextareaField } from "@/components/forms/FormField";
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

const REJECTION_REASONS = [
  "Blurry or unreadable",
  "Wrong semester or term",
  "Incomplete or cropped",
  "Not a valid COR",
  "Name mismatch",
  "Other",
] as const;

// COR review needs Admin or a Librarian with the COR_REVIEW permission (enforced by the backend).
export default function CORReviewPanel({ item, onClose, onDone }: CORReviewPanelProps) {
  const toast = useToast();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reviewConfirmation, setReviewConfirmation] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [docNote, setDocNote] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [showDoc, setShowDoc] = useState(false);
  const pending = item.status === "PENDING";

  const confirmRejection = () => {
    const nextReasonError = reason ? null : "Choose a reason for rejection.";
    const nextMessageError = reason === "Other" && !message.trim()
      ? "Add a message when the reason is Other."
      : null;
    setReasonError(nextReasonError);
    setMessageError(nextMessageError);
    if (!nextReasonError && !nextMessageError) setReviewConfirmation("reject");
  };

  useEffect(() => {
    return () => {
      if (docUrl) URL.revokeObjectURL(docUrl);
    };
  }, [docUrl]);

  const run = async (kind: "approve" | "reject") => {
    if (kind === "reject" && (!reason || (reason === "Other" && !message.trim()))) {
      confirmRejection();
      throw new Error("Choose a rejection reason and complete the message when required.");
    }
    setBusy(kind);
    setError(null);
    try {
      if (kind === "approve") await verificationService.approveCor(item.id);
      else {
        const rejectionReason = message.trim() ? `${reason}: ${message.trim()}` : reason;
        await verificationService.rejectCor(item.id, { reason: rejectionReason });
      }
      toast.success(kind === "approve" ? "COR approved." : "COR rejected. The student can resubmit.");
      onDone();
      onClose();
    } catch (e) {
      setError(describeError(e));
      setBusy(null);
      throw e;
    }
  };

  const openDocument = async () => {
    if (docUrl) {
      setShowDoc(!showDoc);
      return;
    }
    setDocLoading(true);
    setDocError(null);
    setDocNote(null);
    try {
      const info = await verificationService.getCorDocumentInfo(item.id);
      if (info.simulated) {
        setDocNote(`${info.fileName}: Demo mode (simulated document).`);
      } else if (info.url) {
        setDocUrl(info.url);
        setShowDoc(true);
      }
    } catch (e) {
      setDocError(describeError(e));
    } finally {
      setDocLoading(false);
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
              <Button variant="danger" onClick={confirmRejection} loading={busy === "reject"}>
                Confirm rejection
              </Button>
            )}
            <Button onClick={() => setReviewConfirmation("approve")} loading={busy === "approve"} disabled={rejecting}>
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
        <div><dt>Student number</dt><dd>{item.student.studentNumber || "—"}</dd></div>
        {item.student.email && <div><dt>Email</dt><dd>{item.student.email}</dd></div>}
        {(item.student.college || item.student.course) && (
          <div>
            <dt>College / Course</dt>
            <dd>{[item.student.college, item.student.course].filter(Boolean).join(" · ")}</dd>
          </div>
        )}
        {(item.student.yearLevel != null || item.student.studentType) && (
          <div>
            <dt>Level / Type</dt>
            <dd>{[item.student.yearLevel != null ? `Year ${item.student.yearLevel}` : null, item.student.studentType].filter(Boolean).join(" · ")}</dd>
          </div>
        )}
        <div><dt>Term</dt><dd>{item.termName}</dd></div>
        <div><dt>Status</dt><dd><StatusBadge status={item.status} /></dd></div>
        <div><dt>Submitted</dt><dd>{formatDate(item.submittedAt)}</dd></div>
        <div><dt>File name</dt><dd>{item.originalFileName || "cor_proof.jpg"}</dd></div>
        {item.effectiveFrom && item.validUntil && (
          <div><dt>Valid</dt><dd>{formatDate(item.effectiveFrom)} – {formatDate(item.validUntil)}</dd></div>
        )}
        {item.reviewer && (
          <div>
            <dt>Reviewed by</dt>
            <dd>{item.reviewer.name} {item.reviewer.role ? `(${item.reviewer.role})` : ""}</dd>
          </div>
        )}
        {item.reviewedAt && <div><dt>Reviewed on</dt><dd>{formatDate(item.reviewedAt)}</dd></div>}
        {item.rejectionReason && <div><dt>Rejection reason</dt><dd>{item.rejectionReason}</dd></div>}
      </dl>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Button variant="ghost" size="sm" onClick={openDocument} loading={docLoading}>
            {docUrl ? (showDoc ? "Hide document photo" : "Show document photo") : "View captured COR photo"}
          </Button>
          {docUrl && (
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
              style={{ textDecoration: "none", fontSize: "0.85rem" }}
            >
              Open in new tab ↗
            </a>
          )}
        </div>
        {docNote && <div style={{ marginTop: 8 }}><Alert kind="info">{docNote}</Alert></div>}
        {docError && <div style={{ marginTop: 8 }}><Alert kind="error">{docError}</Alert></div>}
        {showDoc && docUrl && (
          <div
            style={{
              marginTop: 10,
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid var(--color-line, #e2e8f0)",
              backgroundColor: "#000",
              maxHeight: 480,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={docUrl}
              alt={`COR document for ${item.student.name}`}
              style={{ maxWidth: "100%", maxHeight: 480, objectFit: "contain" }}
            />
          </div>
        )}
      </div>

      {pending && rejecting && (
        <div style={{ marginTop: 12 }}>
          <SelectField
            label="Reason"
            value={reason}
            error={reasonError}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError(null);
              setMessageError(null);
            }}
            required
          >
            <option value="">Choose a reason</option>
            {REJECTION_REASONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
          <TextareaField
            label="Message"
            hint="Optional, except when the reason is Other."
            value={message}
            error={messageError}
            onChange={(e) => {
              setMessage(e.target.value);
              setMessageError(null);
            }}
            required={reason === "Other"}
          />
        </div>
      )}
      {error && <div style={{ marginTop: 10 }}><Alert kind="error">{error}</Alert></div>}
      {reviewConfirmation && (
        <ConfirmDialog
          title={reviewConfirmation === "approve" ? `Approve ${item.student.name}'s COR?` : `Reject ${item.student.name}'s COR?`}
          message={reviewConfirmation === "approve"
            ? `This approves the Certificate of Registration for ${item.termName}.`
            : `This rejects the Certificate of Registration for ${item.termName}; the student will need to resubmit.`}
          details={[
            { label: "Student", value: item.student.name },
            { label: "Term", value: item.termName },
          ]}
          variant={reviewConfirmation === "reject" ? "destructive" : "positive"}
          confirmLabel={reviewConfirmation === "approve" ? "Approve COR" : "Reject COR"}
          onClose={() => setReviewConfirmation(null)}
          onConfirm={() => run(reviewConfirmation)}
        />
      )}
    </Modal>
  );
}