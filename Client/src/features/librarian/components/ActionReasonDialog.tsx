import { useState } from "react";
import ConfirmDialog, { type ConfirmDetails } from "@/components/feedback/ConfirmDialog";
import { SelectField, TextareaField } from "@/components/forms/FormField";

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
  notesRequired?: boolean;
  details?: ConfirmDetails[];
  onSubmit: (reasonCode: string, notes: string) => Promise<void>;
  onClose: () => void;
}

export default function ActionReasonDialog({ title, intro, reasons, confirmLabel, danger = false, notesRequired = true, details, onSubmit, onClose }: ActionReasonDialogProps) {
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async () => {
    if (!code) throw new Error("Choose a reason.");
    if (notesRequired && !notes.trim()) throw new Error("Add notes explaining the decision.");
    await onSubmit(code, notes.trim());
  };

  return (
    <ConfirmDialog
      title={title}
      message={intro}
      details={details}
      variant={danger ? "destructive" : "normal"}
      confirmLabel={confirmLabel}
      onClose={onClose}
      onConfirm={submit}
    >
      <SelectField label="Reason" value={code} onChange={(e) => setCode(e.target.value)} required>
        <option value="">Choose…</option>
        {reasons.map((r) => (
          <option key={r.code} value={r.code}>
            {r.label}
          </option>
        ))}
      </SelectField>
      <TextareaField label={notesRequired ? "Notes (shown to the student)" : "Message (optional)"} value={notes} onChange={(e) => setNotes(e.target.value)} required={notesRequired} />
    </ConfirmDialog>
  );
}