import { useState, type ReactNode } from "react";
import { describeError } from "@/utils/errors";
import Alert from "./Alert";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { TextareaField } from "../forms/FormField";

interface ConfirmDialogProps {
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** When set, a required reason box is shown and its text is passed to onConfirm. */
  reasonLabel?: string;
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
}

/** Runs onConfirm, shows the error inside the dialog if it throws, and closes on success. */
export default function ConfirmDialog({
  title,
  children,
  confirmLabel = "Confirm",
  danger = false,
  reasonLabel,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (reasonLabel && !reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={submit} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {reasonLabel && <TextareaField label={reasonLabel} value={reason} onChange={(e) => setReason(e.target.value)} required />}
      {error && <Alert kind="error">{error}</Alert>}
    </Modal>
  );
}