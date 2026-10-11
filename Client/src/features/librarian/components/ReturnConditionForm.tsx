import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { SelectField, TextareaField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import { COPY_CONDITIONS, type CopyCondition, type ReturnResult, type StaffLoan } from "@/types";
import { statusLabel } from "@/utils/constants";
import { describeError } from "@/utils/errors";
import { formatDate } from "@/utils/formatDate";
import * as librarianService from "@/services/librarianService";

interface ReturnConditionFormProps {
  loan: StaffLoan;
  onClose: () => void;
  onDone: (result: ReturnResult) => void;
}

// Returns are never blocked by overdue, fines or suspension. There is no daily overdue fine.
export default function ReturnConditionForm({ loan, onClose, onDone }: ReturnConditionFormProps) {
  const [condition, setCondition] = useState<CopyCondition>("GOOD");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await librarianService.returnLoan(loan.id, { condition, notes: notes.trim() || undefined });
      onDone(result);
      onClose();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Confirm return"
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Confirm return
          </Button>
        </>
      }
    >
      <div>
        <strong>{loan.bookTitle}</strong>
        <p className="subtle">
          Copy {loan.copyBarcode} · {loan.student.firstName} {loan.student.lastName} · due {formatDate(loan.dueAt)}
        </p>
      </div>
      <SelectField label="Condition of the returned copy" value={condition} onChange={(e) => setCondition(e.target.value as CopyCondition)}>
        {COPY_CONDITIONS.map((c) => (
          <option key={c} value={c}>
            {statusLabel(c)}
          </option>
        ))}
      </SelectField>
      <TextareaField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <p className="subtle">
        {condition === "GOOD" || condition === "NEW" || condition === "FAIR"
          ? "A usable copy goes back to the shelf, or is offered to the first eligible student in the reservation queue."
          : condition === "DAMAGED"
            ? "A damaged copy goes to maintenance. Record a damage fine afterwards from the Fines page if needed."
            : "An unusable copy is withdrawn. Record a damage fine afterwards from the Fines page if needed."}
      </p>
      {error && <Alert kind="error">{error}</Alert>}
    </Modal>
  );
}