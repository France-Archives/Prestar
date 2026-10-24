import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import { InputField, SelectField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";
import * as adminService from "@/services/adminService";
import type { AcademicTerm, TermStatus } from "@/types";
import { statusLabel } from "@/utils/constants";
import { describeError } from "@/utils/errors";
import { validateDateRange } from "@/utils/validators";

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
  const [busy, setBusy] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);

  const field = (k: "name" | "startDate" | "endDate" | "corDeadline") => ({
    value: v[k],
    error: errors[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }),
  });

  const submit = async () => {
    const found: Record<string, string> = {};
    if (!v.name.trim()) found.name = "Name is required.";
    if (!v.startDate) found.startDate = "Start date is required.";
    if (!v.endDate) found.endDate = "End date is required.";
    if (!v.corDeadline) found.corDeadline = "COR deadline is required.";
    if (v.startDate && v.endDate) {
      const m = validateDateRange(v.startDate, v.endDate);
      if (m) found.endDate = m;
    }
    if (v.corDeadline && v.endDate && v.corDeadline > v.endDate) found.corDeadline = "The COR deadline cannot be after the end date.";
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    if (term && v.status !== term.status) {
      setConfirmStatus(true);
      return;
    }
    void saveTerm();
  };

  const saveTerm = async (confirmed = false) => {
    setBusy(true);
    try {
      const body = { name: v.name.trim(), startDate: v.startDate, endDate: v.endDate, corDeadline: v.corDeadline, status: v.status };
      if (term) await adminService.updateAcademicTerm(term.id, body);
      else await adminService.createAcademicTerm(body);
      toast.success(term ? "Term updated." : "Term created.");
      onDone();
      onClose();
    } catch (e) {
      setFormError(describeError(e));
      if (confirmed) throw e;
    } finally {
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