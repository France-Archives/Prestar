import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import { SelectField, TextareaField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import { COPY_CONDITIONS, FINE_TYPES, type CopyCondition, type FineType, type ReturnResult, type StaffLoan } from "@/types";
import { statusLabel, USE_MOCKS } from "@/utils/constants";
import { describeError } from "@/utils/errors";
import { formatDate } from "@/utils/formatDate";
import * as librarianService from "@/services/librarianService";
import CorCameraCapture from "@/features/student/components/CorCameraCapture";

interface ReturnConditionFormProps {
  loan: StaffLoan;
  onClose: () => void;
  onDone: (result: ReturnResult) => void;
}

// Returns are never blocked by overdue, fines or suspension. There is no daily overdue fine.
export default function ReturnConditionForm({ loan, onClose, onDone }: ReturnConditionFormProps) {
  const [condition, setCondition] = useState<CopyCondition>("GOOD");
  const [notes, setNotes] = useState("");
  const [damageType, setDamageType] = useState<FineType | "">("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const damageTypes = FINE_TYPES.filter((type): type is Extract<FineType, "DAMAGE_MINOR" | "DAMAGE_MAJOR"> => type !== "LOST_BOOK");
  const damageEvidenceUnavailable = condition === "DAMAGED";
  const canSubmit = USE_MOCKS && !damageEvidenceUnavailable && !busy;

  const submit = async () => {
    if (!canSubmit) throw new Error("This return cannot be submitted.");
    setBusy(true);
    setError(null);
    try {
      const result = await librarianService.returnLoan(loan.id, { condition, notes: notes.trim() || undefined });
      onDone(result);
      onClose();
    } catch (e) {
      setError(describeError(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Modal
      title="Confirm return"
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => setConfirming(true)} disabled={!canSubmit}>
            Confirm return
          </Button>
        </>
      }
    >
      <div>
        <strong>{loan.bookTitle}</strong>
        <p className="subtle">
          Copy {loan.copyBarcode} · {loan.student.firstName} {loan.student.lastName} ({loan.student.studentNumber}) · due {formatDate(loan.dueAt)}
        </p>
      </div>
      <SelectField label="Condition of the returned copy" value={condition} onChange={(e) => setCondition(e.target.value as CopyCondition)}>
        {COPY_CONDITIONS.map((c) => (
          <option key={c} value={c}>
            {statusLabel(c)}
          </option>
        ))}
      </SelectField>
      {condition === "DAMAGED" && (
        <>
          <SelectField label="Damage type" value={damageType} onChange={(event) => setDamageType(event.target.value as FineType)} required>
            <option value="">Choose damage type…</option>
            {damageTypes.map((type) => <option key={type} value={type}>{statusLabel(type)}</option>)}
          </SelectField>
          <CorCameraCapture
            documentLabel="damage evidence"
            allowUploadFallback={false}
            onCapture={setPhoto}
          />
          {!damageType && <p className="subtle">Choose a damage type before confirming.</p>}
          {!photo && <p className="subtle">Capture a live camera photo of the damage before confirming.</p>}
          <Alert kind="info">Damaged returns with a damage record and photo are not available yet because the current service cannot store this evidence. No return will be recorded.</Alert>
        </>
      )}
      <TextareaField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <p className="subtle">
        {condition === "GOOD" || condition === "NEW" || condition === "FAIR"
          ? "A usable copy goes back to the shelf, or is offered to the first eligible student in the reservation queue."
          : condition === "DAMAGED"
            ? "A damaged copy goes to maintenance. Record a damage fine afterwards from the Fines page if needed."
            : "An unusable copy is withdrawn. Record a damage fine afterwards from the Fines page if needed."}
      </p>
      {error && <Alert kind="error">{error}</Alert>}
      {!USE_MOCKS && <Alert kind="info">Returns can't be confirmed yet. Nothing will be saved if you continue.</Alert>}
      {condition === "DAMAGED" && (!damageType || !photo) && <p className="subtle">A damage type and captured photo are required.</p>}
    </Modal>
      {confirming && (
        <ConfirmDialog
          title={`Confirm return of ${loan.bookTitle}?`}
          message={`This closes ${loan.student.firstName} ${loan.student.lastName}'s loan and updates the copy based on its recorded condition.`}
          details={[
            { label: "Book", value: loan.bookTitle },
            { label: "Student", value: `${loan.student.firstName} ${loan.student.lastName}` },
            { label: "Copy", value: loan.copyBarcode },
            { label: "Condition", value: statusLabel(condition) },
          ]}
          variant="positive"
          confirmLabel="Confirm return"
          loading={busy}
          onClose={() => setConfirming(false)}
          onConfirm={submit}
        />
      )}
    </>
  );
}