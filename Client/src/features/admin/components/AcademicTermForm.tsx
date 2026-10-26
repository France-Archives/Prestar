import { useRef, useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import { InputField, SelectField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";
import * as adminService from "@/services/adminService";
import type { AcademicTerm, TermStatus } from "@/types";
import { statusLabel } from "@/utils/constants";
import { describeError, toApiError } from "@/utils/errors";

const STATUSES: TermStatus[] = ["UPCOMING", "ACTIVE", "COMPLETED"];

interface Props {
  term?: AcademicTerm | null;
  onClose: () => void;
  onDone: () => void;
}

// Term dates and COR deadlines are configured by Admin, never hard-coded (TC-06). Overlap rules are TO CONFIRM (TC-05).
export default function AcademicTermForm({ term, onClose, onDone }: Props) {
  const toast = useToast();
  const [v, setV] = useState({
    name: term?.name ?? "",
    startDate: term?.startDate ?? "",
    endDate: term?.endDate ?? "",
    corDeadline: term?.corDeadline ?? "",
    status: (term?.status ?? "UPCOMING") as TermStatus,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [activeConflict, setActiveConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const submitting = useRef(false);

  const field = (k: "name" | "startDate" | "endDate" | "corDeadline") => ({
    value: v[k],
    error: errors[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setV({ ...v, [k]: e.target.value });
      setErrors((current) => ({ ...current, [k]: "" }));
    },
  });

  const submit = async () => {
    const found: Record<string, string> = {};
    if (!v.name.trim()) found.name = "Name is required.";
    else if (v.name.trim().length > 100) found.name = "Name must be 100 characters or fewer.";
    if (!v.startDate) found.startDate = "Start date is required.";
    if (!v.endDate) found.endDate = "End date is required.";
    if (!v.corDeadline) found.corDeadline = "COR deadline is required.";
    if (v.startDate && v.endDate) {
      if (v.endDate < v.startDate) found.endDate = "The end date cannot be before the start date.";
    }
    if (v.startDate && v.corDeadline && v.corDeadline < v.startDate) {
      found.corDeadline = "The COR deadline cannot be before the start date.";
    }
    if (v.corDeadline && v.endDate && v.corDeadline > v.endDate) found.corDeadline = "The COR deadline cannot be after the end date.";
    setErrors(found);
    setFormError(null);
    setActiveConflict(false);
    if (Object.keys(found).length) return;
    if (term && v.status !== term.status) {
      setConfirmStatus(true);
      return;
    }
    void saveTerm();
  };

  const saveTerm = async (confirmed = false) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      const body = { name: v.name.trim(), startDate: v.startDate, endDate: v.endDate, corDeadline: v.corDeadline, status: v.status };
      if (term) await adminService.updateAcademicTerm(term.id, body);
      else await adminService.createAcademicTerm(body);
      toast.success(term ? "Term updated." : "Term created.");
      onDone();
      onClose();
    } catch (e) {
      const error = toApiError(e);
      const message = describeError(error);
      if (error.status === 409 && /another term is already active/i.test(message)) {
        setActiveConflict(true);
      } else if (error.status === 409) {
        setErrors((current) => ({ ...current, name: message }));
      } else if (error.status === 422) {
        const details = error.details ?? {};
        const nested = details.errors ?? details.fields ?? details.fieldErrors;
        const fieldDetails = typeof nested === "object" && nested !== null && !Array.isArray(nested)
          ? nested as Record<string, unknown>
          : details;
        const fieldMap: Record<string, keyof typeof v> = {
          name: "name",
          startDate: "startDate",
          endDate: "endDate",
          corDeadline: "corDeadline",
        };
        let hasFieldError = false;
        const nextErrors: Record<string, string> = {};
        for (const [serverField, formField] of Object.entries(fieldMap)) {
          const detail = fieldDetails[serverField];
          if (typeof detail === "string") {
            nextErrors[formField] = detail;
            hasFieldError = true;
          } else if (Array.isArray(detail) && typeof detail[0] === "string") {
            nextErrors[formField] = detail[0];
            hasFieldError = true;
          } else if (typeof detail === "object" && detail !== null
            && "message" in detail && typeof detail.message === "string") {
            nextErrors[formField] = detail.message;
            hasFieldError = true;
          }
        }
        setErrors(nextErrors);
        if (!hasFieldError) setFormError(message);
      } else {
        setFormError(message);
      }
      if (confirmed) throw e;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <>
    <Modal
      title={term ? "Edit academic term" : "Add academic term"}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy}>Save term</Button>
        </>
      }
    >
      <InputField label="Name" required {...field("name")} />
      <div className="form-row">
        <InputField label="Start date" type="date" required {...field("startDate")} />
        <InputField label="End date" type="date" required {...field("endDate")} />
      </div>
      <InputField label="COR deadline" type="date" required hint="Must be on or before the end date." {...field("corDeadline")} />
      <SelectField label="Status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as TermStatus })}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{statusLabel(s)}</option>
        ))}
      </SelectField>
      {formError && <Alert kind="error">{formError}</Alert>}
      {activeConflict && <Alert kind="error">Another term is already active. Complete it first.</Alert>}
    </Modal>
      {confirmStatus && term && (
        <ConfirmDialog
          title={`Change ${term.name} status?`}
          message={`The academic term will change from ${statusLabel(term.status)} to ${statusLabel(v.status)}, affecting term-dependent COR workflows.`}
          details={[
            { label: "Academic term", value: term.name },
            { label: "New status", value: statusLabel(v.status) },
          ]}
          confirmLabel="Update term status"
          onClose={() => setConfirmStatus(false)}
          onConfirm={() => saveTerm(true)}
        />
      )}
    </>
  );
}