import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { SelectField, TextareaField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";
import * as adminService from "@/services/adminService";
import type { AccountStatus, AdminUserRow } from "@/types";
import { statusLabel } from "@/utils/constants";
import { describeError } from "@/utils/errors";

const OPTIONS: AccountStatus[] = ["ACTIVE", "SUSPENDED", "DISABLED"];

interface Props {
  user: AdminUserRow;
  onClose: () => void;
  onDone: () => void;
}

// A reason is required and audited. Suspension never changes existing loans or due dates.
// Reversing DISABLED is TO CONFIRM; the mock allows it.
export default function AccountStatusDialog({ user, onClose, onDone }: Props) {
  const toast = useToast();
  const [status, setStatus] = useState<AccountStatus>(user.accountStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason.trim()) return setError("A reason is required.");
    setBusy(true);
    setError(null);
    try {
      await adminService.updateUserStatus(user.id, { status, reason: reason.trim() });
      toast.success("Account status updated.");
      onDone();
      onClose();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Change status: ${user.displayName}`}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={status === "ACTIVE" ? "primary" : "danger"} onClick={submit} loading={busy}>Update status</Button>
        </>
      }
    >
      <p className="subtle">Current status: {statusLabel(user.accountStatus)}. Existing loans and due dates are not changed; new borrowing, reservations and renewals are blocked while not active.</p>
      <SelectField label="New status" value={status} onChange={(e) => setStatus(e.target.value as AccountStatus)}>
        {OPTIONS.map((s) => (
          <option key={s} value={s}>{statusLabel(s)}</option>
        ))}
      </SelectField>
      <TextareaField label="Reason (kept in the audit log)" value={reason} onChange={(e) => setReason(e.target.value)} required />
      {error && <Alert kind="error">{error}</Alert>}
    </Modal>
  );
}