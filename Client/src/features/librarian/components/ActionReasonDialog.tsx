import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { SelectField, TextareaField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import { describeError } from "@/utils/errors";

export interface ReasonOption {
  code: string;
  label: string;
}

// Reason codes are TO CONFIRM with the library. The backend only requires that a reason code and notes are present.
export const HOLD_REASONS: ReasonOption[] = [
  { code: "OVERDUE_LOAN", label: "Overdue loan to resolve" },
  { code: "UNPAID_FINE", label: "Unpaid fine to settle" },
  { code: "COR_ISSUE", label: "COR issue to resolve" },
  { code: "OTHER", label: "Other resolvable issue" },
];

export const REJECT_REASONS: ReasonOption[] = [
  { code: "COPY_MISMATCH", label: "Copy does not match the assignment" },
  { code: "COPY_DAMAGED", label: "Copy is damaged" },
  { code: "IDENTITY_UNVERIFIED", label: "Student identity not verified" },
  { code: "DATA_INCONSISTENT", label: "Data is inconsistent" },
  { code: "OTHER", label: "Other" },
];

interface ActionReasonDialogProps {
  title: string;
  intro?: string;
  reasons: ReasonOption[];
  confirmLabel: string;
  danger?: boolean;
  onSubmit: (reasonCode: string, notes: string) => Promise<void>;
  onClose: () => void;
}

export default function ActionReasonDialog({ title, intro, reasons, confirmLabel, danger = false, onSubmit, onClose }: ActionReasonDialogProps) {
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!code) return setError("Choose a reason.");
    if (!notes.trim()) return setError("Add notes explaining the decision.");
    setBusy(true);
    setError(null);
    try {
      await onSubmit(code, notes.trim());
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
      {intro && <p className="subtle">{intro}</p>}
      <SelectField label="Reason" value={code} onChange={(e) => setCode(e.target.value)} required>
        <option value="">Choose…</option>
        {reasons.map((r) => (
          <option key={r.code} value={r.code}>
            {r.label}
          </option>
        ))}
      </SelectField>
      <TextareaField label="Notes (shown to the student)" value={notes} onChange={(e) => setNotes(e.target.value)} required />
      {error && <Alert kind="error">{error}</Alert>}
    </Modal>
  );
}