import { useState } from "react";
import Alert, { MockTag } from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { InputField, SelectField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import Money from "@/components/data-display/Money";
import { useToast } from "@/hooks/useToast";
import * as finesService from "@/services/finesService";
import { PAYMENT_METHODS, type PaymentMethod, type StaffFine } from "@/types";
import { statusLabel } from "@/utils/constants";
import { describeError } from "@/utils/errors";

interface PaymentFormProps {
  fine: StaffFine;
  onClose: () => void;
  onDone: () => void;
}

// Payments are made IN PERSON. This form only RECORDS a payment received at the desk; nothing here moves money.
export default function PaymentForm({ fine, onClose, onDone }: PaymentFormProps) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(fine.balance));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const n = Number(amount);
    if (!(n > 0)) return setError("Enter an amount greater than 0.");
    if (n > fine.balance) return setError("The amount cannot be more than the balance.");
    setBusy(true);
    setError(null);
    try {
      await finesService.recordPayment(fine.id, { amount: n, paymentMethod: method, referenceNumber: reference.trim() || null });
      toast.success("Payment recorded.");
      onDone();
      onClose();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Record payment"
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Record payment
          </Button>
        </>
      }
    >
      <div>
        <strong>
          {fine.student.firstName} {fine.student.lastName}
        </strong>
        <p className="subtle">
          {statusLabel(fine.fineType)} · {fine.bookTitle} · balance <Money value={fine.balance} />
        </p>
      </div>
      <Alert kind="info">
        Record only money already received in person. <MockTag>Demo</MockTag> The demo keeps this record in memory only.
      </Alert>
      <InputField label="Amount (₱)" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <SelectField label="Payment method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
        {PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {statusLabel(m)}
          </option>
        ))}
      </SelectField>
      <InputField label="Reference number (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
      {error && <Alert kind="error">{error}</Alert>}
    </Modal>
  );
}