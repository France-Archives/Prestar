import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import { InputField, SelectField, TextareaField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";
import * as booksService from "@/services/booksService";
import { COPY_CONDITIONS, type BookCopy, type BookCopyStatus, type CopyCondition, type CreateCopyRequest, type UpdateCopyRequest, type UUID } from "@/types";
import { statusLabel } from "@/utils/constants";
import { describeError } from "@/utils/errors";

type CopyFormProps = { onClose: () => void; onDone: () => void; bookTitle?: string } & ({ bookId: UUID; copy?: undefined } | { copy: BookCopy; bookId?: undefined });

// ON_LOAN and RESERVED are changed only by handover, returns, cancellation and expiry, so they are locked here.
const EDITABLE: BookCopyStatus[] = ["AVAILABLE", "MAINTENANCE", "LOST", "WITHDRAWN"];

export default function CopyForm({ bookId, copy, bookTitle, onClose, onDone }: CopyFormProps) {
  const toast = useToast();
  const locked = copy ? copy.status === "ON_LOAN" || copy.status === "RESERVED" : false;
  const [status, setStatus] = useState<BookCopyStatus>(copy?.status ?? "AVAILABLE");
  const [condition, setCondition] = useState<CopyCondition>(copy?.condition ?? "GOOD");
  const [section, setSection] = useState(copy?.section ?? "");
  const [shelfCode, setShelfCode] = useState(copy?.shelfCode ?? "");
  const [levelOrRow, setLevelOrRow] = useState(copy?.levelOrRow ?? "");
  const [locationNotes, setLocationNotes] = useState(copy?.locationNotes ?? "");
  const [acquired, setAcquired] = useState(copy?.acquisitionDate ?? "");
  const [notes, setNotes] = useState(copy?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = async (confirmed = false) => {
    setBusy(true);
    setError(null);
    try {
      const legacyLocation = [section.trim(), shelfCode.trim(), levelOrRow.trim()].filter(Boolean).join(" / ") || null;
      if (copy) {
        const body: UpdateCopyRequest = {
          condition,
          section: section.trim() || null,
          shelfCode: shelfCode.trim() || null,
          levelOrRow: levelOrRow.trim() || null,
          locationNotes: locationNotes.trim() || null,
          shelfLocation: legacyLocation,
          notes: notes.trim() || null,
        };
        if (!locked && status !== copy.status) body.status = status;
        await booksService.updateCopy(copy.id, body);
        toast.success("Copy updated.");
      } else {
        const body: CreateCopyRequest = {
          condition,
          section: section.trim() || null,
          shelfCode: shelfCode.trim() || null,
          levelOrRow: levelOrRow.trim() || null,
          locationNotes: locationNotes.trim() || null,
          shelfLocation: legacyLocation,
          acquisitionDate: acquired || null,
          notes: notes.trim() || null,
        };
        await booksService.createCopy(bookId, body);
        toast.success("Copy added.");
      }
      onDone();
      onClose();
    } catch (e) {
      setError(describeError(e));
      if (confirmed) throw e;
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (copy && !locked && status !== copy.status && (status === "LOST" || status === "WITHDRAWN")) {
      setConfirmStatus(true);
      return;
    }
    void persist();
  };

  return (
    <>
    <Modal
      title={copy ? `Edit copy ${copy.barcode}` : "Add copy"}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={busy}>
            Save copy
          </Button>
        </>
      }
    >
      {!copy && <p className="subtle">A unique barcode will be generated automatically when this copy is saved.</p>}
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
        <InputField label="Section" value={section} onChange={(e) => setSection(e.target.value)} />
        <InputField label="Shelf code" value={shelfCode} onChange={(e) => setShelfCode(e.target.value)} />
      </div>
      <div className="form-row">
        <InputField label="Level / row" value={levelOrRow} onChange={(e) => setLevelOrRow(e.target.value)} />
        {!copy && <InputField label="Acquisition date" type="date" value={acquired} onChange={(e) => setAcquired(e.target.value)} />}
      </div>
      <TextareaField label="Location notes" value={locationNotes} onChange={(e) => setLocationNotes(e.target.value)} />
      <TextareaField label="Copy notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <Alert kind="error">{error}</Alert>}
    </Modal>
      {confirmStatus && copy && (
        <ConfirmDialog
          title={`Change copy ${copy.barcode} to ${statusLabel(status)}?`}
          message={`This changes the circulation status of ${bookTitle ?? "this copy"} to ${statusLabel(status).toLowerCase()}.`}
          details={[
            { label: "Copy", value: copy.barcode },
            { label: "Book", value: bookTitle ?? "—" },
            { label: "New status", value: statusLabel(status) },
          ]}
          variant="destructive"
          confirmLabel={`Set ${statusLabel(status)}`}
          loading={busy}
          onClose={() => setConfirmStatus(false)}
          onConfirm={() => persist(true)}
        />
      )}
    </>
  );
}