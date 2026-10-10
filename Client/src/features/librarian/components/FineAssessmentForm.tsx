import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { SelectField, TextareaField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import Money from "@/components/data-display/Money";
import { useToast } from "@/hooks/useToast";
import * as finesService from "@/services/finesService";
import type { FineType, StaffLoan } from "@/types";
import { FINE_AMOUNTS, statusLabel } from "@/utils/constants";
import { describeError } from "@/utils/errors";
import { formatDate } from "@/utils/formatDate";

const TYPES: FineType[] = ["DAMAGE_MINOR", "DAMAGE_MAJOR", "LOST_BOOK"];

interface FineAssessmentFormProps {
  loans: StaffLoan[];
  defaultLoanId?: string;
  onClose: () => void;
  onDone: () => void;
}

// The amount is shown for information only. The server chooses it from the fixed table (₱100 / ₱200 / ₱500).
export default function FineAssessmentForm({ loans, defaultLoanId = "", onClose, onDone }: FineAssessmentFormProps) {
  const toast = useToast();
  const [fineType, setFineType] = useState<FineType>("DAMAGE_MINOR");
  const [loanId, setLoanId] = useState(defaultLoanId);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = loans.filter((l) => (fineType === "LOST_BOOK" ? l.status === "LOST" : l.status !== "LOST"));
  const selected = options.some((l) => l.id === loanId) ? loanId : "";

  const submit = async () => {
    if (!selected) return setError("Choose a loan.");
    if (!notes.trim()) return setError("Notes are required.");
    setBusy(true);
    setError(null);
    try {
      await finesService.createFine(selected, { fineType, notes: notes.trim() });
      toast.success("Fine recorded. The student is notified.");
      onDone();
      onClose();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Assess a fine"
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Record fine
          </Button>
        </>
      }
    >
      <SelectField label="Fine type" value={fineType} onChange={(e) => setFineType(e.target.value as FineType)}>
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {statusLabel(t)} (₱{FINE_AMOUNTS[t]})
          </option>
        ))}
      </SelectField>
      <SelectField label="Loan" value={selected} onChange={(e) => setLoanId(e.target.value)} required>
        <option value="">Choose…</option>
        {options.map((l) => (
          <option key={l.id} value={l.id}>
            {l.bookTitle} · {l.student.firstName} {l.student.lastName} · borrowed {formatDate(l.borrowedAt)}
          </option>
        ))}
      </SelectField>
      {fineType === "LOST_BOOK" && <p className="subtle">A lost-book fine needs the loan to be marked lost first (Returns page).</p>}
      <p>
        Fine amount: <b><Money value={FINE_AMOUNTS[fineType]} /></b> <span className="subtle">(set by the server)</span>
      </p>
      <TextareaField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} required />
      {error && <Alert kind="error">{error}</Alert>}
    </Modal>
  );
}