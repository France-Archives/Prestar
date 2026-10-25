import { useId, useRef, useState, type ReactNode } from "react";
import { Check, CircleHelp, TriangleAlert } from "lucide-react";
import { describeError } from "@/utils/errors";
import Alert from "./Alert";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { TextareaField } from "../forms/FormField";

export type ConfirmVariant = "normal" | "destructive" | "positive";

export interface ConfirmDetails {
  label: string;
  value: ReactNode;
}

interface ConfirmDialogProps {
  title: string;
  message?: string;
  details?: ConfirmDetails[];
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  danger?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  loading?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  details,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant,
  danger = false,
  requireReason = false,
  reasonLabel,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const messageId = useId();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const destructive = (variant ?? (danger ? "destructive" : "normal")) === "destructive";
  const selectedVariant = variant ?? (danger ? "destructive" : "normal");
  const needsReason = requireReason || Boolean(reasonLabel);
  const Icon = selectedVariant === "destructive" ? TriangleAlert : selectedVariant === "positive" ? Check : CircleHelp;

  const submit = async () => {
    if (submitting.current || loading) return;
    if (needsReason && !reason.trim()) {
      setError("A reason is required.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setError(describeError(e));
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={busy || loading ? () => undefined : onClose}
      className="confirm-dialog"
      role={destructive ? "alertdialog" : "dialog"}
      descriptionId={message ? messageId : undefined}
      initialFocus={destructive ? "cancel" : "confirm"}
      closeBlocked={busy || loading}
      footer={
        <div className={`confirm-dialog__actions${destructive ? " is-destructive" : ""}`}>
          <Button
            type="button"
            variant="ghost"
            className="confirm-dialog__cancel"
            onClick={onClose}
            disabled={busy || loading}
            data-modal-focus="cancel"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "danger" : "primary"}
            className="confirm-dialog__confirm"
            onClick={() => void submit()}
            loading={busy || loading}
            disabled={busy || loading}
            data-modal-focus="confirm"
          >
            {busy || loading ? "Working..." : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className={`confirm-dialog__icon is-${selectedVariant}`} aria-hidden="true">
        <Icon size={24} strokeWidth={2} />
      </div>
      {message && <p id={messageId} className="confirm-dialog__message">{message}</p>}
      {details && details.length > 0 && (
        <dl className="confirm-dialog__details">
          {details.map((detail, index) => (
            <div key={`${detail.label}-${index}`}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
      {needsReason && (
        <TextareaField
          label={reasonLabel ?? "Reason"}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
        />
      )}
      {error && <Alert kind="error">{error}</Alert>}
    </Modal>
  );
}
