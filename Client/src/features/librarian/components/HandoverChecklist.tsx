import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import Card from "@/components/ui/Card";
import { CheckboxField } from "@/components/forms/FormField";
import { useToast } from "@/hooks/useToast";
import * as librarianService from "@/services/librarianService";
import type { BookToRelease, PenaltyCheck } from "@/types";
import { USE_MOCKS } from "@/utils/constants";
import { describeError } from "@/utils/errors";
import ActionReasonDialog, { HOLD_REASONS, REJECT_REASONS } from "./ActionReasonDialog";
import PenaltySummary from "./PenaltySummary";

interface HandoverChecklistProps {
  item: BookToRelease;
  onChanged: () => void;
}

// Check Penalties -> Confirm Handover. The backend re-checks eligibility inside the handover transaction,
// and mandatory restrictions cannot be bypassed here. Hold and Reject Handover are separate actions.
export default function HandoverChecklist({ item, onChanged }: HandoverChecklistProps) {
  const toast = useToast();
  const [check, setCheck] = useState<PenaltyCheck | null>(null);
  const [idOk, setIdOk] = useState(false);
  const [copyOk, setCopyOk] = useState(false);
  const [busy, setBusy] = useState<"check" | "claim" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"hold" | "reject" | null>(null);
  const [confirmClaim, setConfirmClaim] = useState(false);

  const runCheck = async () => {
    setBusy("check");
    setError(null);
    try {
      setCheck(await librarianService.checkHandoverEligibility(item.requestId));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  const confirm = async () => {
    setBusy("claim");
    setError(null);
    try {
      await librarianService.claimHandover(item.requestId, { copyBarcode: item.copy.barcode });
      toast.success("Handover confirmed. The loan has started.");
      onChanged();
    } catch (e) {
      setError(describeError(e));
      setCheck(null); // eligibility may have changed: check again
      throw e;
    } finally {
      setBusy(null);
    }
  };

  const canConfirm = Boolean(check?.eligible) && idOk && copyOk;

  return (
    <Card title="Handover" note="Step 1: Check Penalties. Step 2: verify the student and the copy. Step 3: Confirm Handover.">
      <div className="stack">
        <div>
          <Button variant="ghost" onClick={runCheck} loading={busy === "check"}>
            Review / Check
          </Button>
        </div>
        {check && <PenaltySummary check={check} />}

        <hr style={{ border: 0, borderTop: "1px solid var(--color-line)" }} />

        <CheckboxField label="I checked the student's school ID against the name and student number on this request." checked={idOk} onChange={(e) => setIdOk(e.target.checked)} />
        <CheckboxField label={`I checked that the assigned copy (${item.copy.barcode}) is in my hand and in usable condition.`} checked={copyOk} onChange={(e) => setCopyOk(e.target.checked)} />

        {error && <Alert kind="error">{error}</Alert>}

        <div className="row-actions">
          <Button onClick={() => setConfirmClaim(true)} disabled={!canConfirm || busy !== null}>
            Confirm Handover
          </Button>
          {USE_MOCKS && item.status === "APPROVED" && (
            <Button variant="ghost" onClick={() => setDialog("hold")}>
              Place on Hold
            </Button>
          )}
          <Button variant="danger" onClick={() => setDialog("reject")}>
            Reject Handover
          </Button>
        </div>
        {!check && <p className="subtle">Confirm Handover unlocks after Review / Check finds the student eligible.</p>}
      </div>

      {confirmClaim && (
        <ConfirmDialog
          title={`Confirm handover to ${item.student.firstName} ${item.student.lastName}?`}
          message={`This releases copy ${item.copy.barcode} and starts the loan for ${item.student.firstName} ${item.student.lastName}.`}
          details={[
            { label: "Book", value: item.book.title },
            { label: "Student", value: `${item.student.firstName} ${item.student.lastName}` },
            { label: "Copy", value: item.copy.barcode },
          ]}
          variant="positive"
          confirmLabel="Confirm handover"
          onClose={() => setConfirmClaim(false)}
          onConfirm={confirm}
        />
      )}

      {dialog === "hold" && (
        <ActionReasonDialog
          title="Place pickup on hold"
          intro={`The copy stays assigned to ${item.student.firstName} ${item.student.lastName} while the issue is resolved.`}
          details={[
            { label: "Book", value: item.book.title },
            { label: "Student", value: `${item.student.firstName} ${item.student.lastName}` },
            { label: "Copy", value: item.copy.barcode },
          ]}
          reasons={HOLD_REASONS}
          confirmLabel="Place on hold"
          onClose={() => setDialog(null)}
          onSubmit={async (reasonCode, notes) => {
            await librarianService.holdHandover(item.requestId, { reasonCode, notes });
            toast.success("Pickup placed on hold.");
            onChanged();
          }}
        />
      )}
      {dialog === "reject" && (
        <ActionReasonDialog
          title={`Reject handover for ${item.student.firstName} ${item.student.lastName}?`}
          intro="The assigned copy will be released and the student will need to request again."
          details={[
            { label: "Book", value: item.book.title },
            { label: "Student", value: `${item.student.firstName} ${item.student.lastName}` },
            { label: "Copy", value: item.copy.barcode },
          ]}
          reasons={REJECT_REASONS}
          confirmLabel="Reject handover"
          danger
          notesRequired={false}
          onClose={() => setDialog(null)}
          onSubmit={async (reasonCode, notes) => {
            await librarianService.rejectHandover(item.requestId, { reasonCode, notes });
            toast.success("Handover rejected.");
            onChanged();
          }}
        />
      )}
    </Card>
  );
}