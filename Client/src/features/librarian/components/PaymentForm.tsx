import { useState } from "react";
import Alert, { MockTag } from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import { InputField, SelectField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import Money from "@/components/data-display/Money";
import { useToast } from "@/hooks/useToast";
import * as finesService from "@/services/finesService";
import { PAYMENT_METHODS, type PaymentMethod, type StaffFine } from "@/types";
import { statusLabel, USE_MOCKS } from "@/utils/constants";
import { ApiError, describeError, toApiError } from "@/utils/errors";

interface PaymentFormProps {
  fine: StaffFine;
  onClose: () => void;
  onDone: () => void;
}

// Payments are made IN PERSON. This form only RECORDS a payment received at the desk; nothing here moves money.
export default function PaymentForm({ fine, onClose, onDone }: PaymentFormProps) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(USE_MOCKS ? fine.balance : fine.amount));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | undefined>();
  const [receiptError, setReceiptError] = useState<string | undefined>();

  const submit = async () => {
    const n = Number(amount);
    if (!(n > 0)) return setError("Enter an amount greater than 0.");
    if (USE_MOCKS && n > fine.balance) return setError("The amount cannot be more than the balance.");
    if (!USE_MOCKS && !reference.trim()) return setError("Official receipt number is required.");
    setConfirming(true);
  };

  const recordPayment = async () => {
    const n = Number(amount);
    if (!(n > 0) || (USE_MOCKS && n > fine.balance) || busy || (!USE_MOCKS && !reference.trim())) throw new Error("Enter a valid payment amount and receipt number.");
    setBusy(true);
    setError(null);
    setAmountError(undefined);
    setReceiptError(undefined);
    try {
      await finesService.recordPayment(fine.id, {
        amount: n,
        paymentMethod: method,
        referenceNumber: reference.trim() || null,
        receiptNo: reference.trim(),
        remarks: remarks.trim() || null,
      });
      toast.success("Payment recorded.");
      onDone();
      onClose();
    } catch (e) {
      const apiError = toApiError(e);
      if (apiError.code === "INVALID_STATE") {
        setError("This fine has already been settled. The list has been refreshed.");
        onDone();
        throw new ApiError("INVALID_STATE", "This fine has already been settled. The list has been refreshed.", 409);
      } else if (!USE_MOCKS && apiError.status === 409) {
        setReceiptError("This official receipt number has already been used.");
      } else if (!USE_MOCKS && (apiError.status === 400 || apiError.message.toLowerCase().includes("partial"))) {
        setAmountError(apiError.message || "Only the full fine amount is accepted.");
      } else {
        setError(describeError(e));
      }
      throw e;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Modal
      title="Record payment"
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || (!USE_MOCKS && !reference.trim())}>
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
          {fine.fineTypeLabel ?? statusLabel(fine.fineType)} · {fine.bookTitle}
        </p>
      </div>
      {USE_MOCKS ? (
        <>
          <Alert kind="info">Record only money already received in person. <MockTag>Demo</MockTag> The demo keeps this record in memory only.</Alert>
          <InputField label="Amount (₱)" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} error={amountError} />
          <SelectField label="Payment method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{statusLabel(m)}</option>)}
          </SelectField>
          <InputField label="Reference number (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
        </>
      ) : (
        <>
          <Alert kind="info">Cash only, full payment. Record only money already received at the library counter.</Alert>
          <InputField label="Amount (₱)" type="number" min={0} step="0.01" value={amount} readOnly />
          <InputField label="Official receipt no." value={reference} onChange={(e) => { setReference(e.target.value); setReceiptError(undefined); }} required error={receiptError} />
          <InputField label="Remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </>
      )}
      {error && <Alert kind="error">{error}</Alert>}
    </Modal>
      {confirming && (
        <ConfirmDialog
          title={`Record a payment of ₱${Number(amount).toFixed(2)}?`}
          message={`This records ₱${Number(amount).toFixed(2)} received from ${fine.student.firstName} ${fine.student.lastName}.`}
          details={[
            { label: "Student", value: `${fine.student.firstName} ${fine.student.lastName}` },
            { label: "Book", value: fine.bookTitle },
            { label: "Payment", value: <Money value={Number(amount)} /> },
          ]}
          confirmLabel="Record payment"
          loading={busy}
          onClose={() => setConfirming(false)}
          onConfirm={recordPayment}
        />
      )}
    </>
  );
}