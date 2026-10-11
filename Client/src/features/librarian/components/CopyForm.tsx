import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { InputField, SelectField, TextareaField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";
import * as booksService from "@/services/booksService";
import { COPY_CONDITIONS, type BookCopy, type BookCopyStatus, type CopyCondition, type CreateCopyRequest, type UpdateCopyRequest, type UUID } from "@/types";
import { statusLabel } from "@/utils/constants";
import { describeError } from "@/utils/errors";

type CopyFormProps = { onClose: () => void; onDone: () => void } & ({ bookId: UUID; copy?: undefined } | { copy: BookCopy; bookId?: undefined });

// ON_LOAN and RESERVED are changed only by handover, returns, cancellation and expiry, so they are locked here.
const EDITABLE: BookCopyStatus[] = ["AVAILABLE", "MAINTENANCE", "LOST", "WITHDRAWN"];

export default function CopyForm({ bookId, copy, onClose, onDone }: CopyFormProps) {
  const toast = useToast();
  const locked = copy ? copy.status === "ON_LOAN" || copy.status === "RESERVED" : false;
  const [barcode, setBarcode] = useState("");
  const [status, setStatus] = useState<BookCopyStatus>(copy?.status ?? "AVAILABLE");
  const [condition, setCondition] = useState<CopyCondition>(copy?.condition ?? "GOOD");
  const [shelf, setShelf] = useState(copy?.shelfLocation ?? "");
  const [acquired, setAcquired] = useState(copy?.acquisitionDate ?? "");
  const [notes, setNotes] = useState(copy?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!copy && !barcode.trim()) return setError("Barcode is required.");
    setBusy(true);
    setError(null);
    try {
      if (copy) {
        const body: UpdateCopyRequest = { condition, shelfLocation: shelf.trim() || null, notes: notes.trim() || null };
        if (!locked && status !== copy.status) body.status = status;
        await booksService.updateCopy(copy.id, body);
        toast.success("Copy updated.");
      } else {
        const body = { barcode: barcode.trim(), condition, shelfLocation: shelf.trim() || null, acquisitionDate: acquired || null, notes: notes.trim() || null };
        await booksService.createCopy(bookId, body as unknown as CreateCopyRequest);
        toast.success("Copy added.");
      }
      onDone();
      onClose();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={copy ? `Edit copy ${copy.barcode}` : "Add copy"}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Save copy
          </Button>
        </>
      }
    >
      {!copy && <InputField label="Barcode" required value={barcode} onChange={(e) => setBarcode(e.target.value)} />}
      {copy && (
        <SelectField
          label="Status"
          value={status}
          disabled={locked}
          hint={locked ? "A copy that is on loan or reserved changes only through returns, handover or cancellation." : undefined}
          onChange={(e) => setStatus(e.target.value as BookCopyStatus)}
        >
          {locked && <option value={copy.status}>{statusLabel(copy.status)}</option>}
          {EDITABLE.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </SelectField>
      )}
      <SelectField label="Condition" value={condition} onChange={(e) => setCondition(e.target.value as CopyCondition)}>
        {COPY_CONDITIONS.map((c) => (
          <option key={c} value={c}>
            {statusLabel(c)}
          </option>
        ))}
      </SelectField>
      <div className="form-row">
        <InputField label="Shelf location" value={shelf} onChange={(e) => setShelf(e.target.value)} />
        {!copy && <InputField label="Acquisition date" type="date" value={acquired} onChange={(e) => setAcquired(e.target.value)} />}
      </div>
      <TextareaField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <Alert kind="error">{error}</Alert>}
    </Modal>
  );
}