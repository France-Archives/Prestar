import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import Card from "@/components/ui/Card";
import { CheckboxField, InputField } from "@/components/forms/FormField";
import { useToast } from "@/hooks/useToast";
import * as librarianService from "@/services/librarianService";
import type { BookToRelease, PenaltyCheck } from "@/types";
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
  const [barcode, setBarcode] = useState("");
  const [idOk, setIdOk] = useState(false);
  const [copyOk, setCopyOk] = useState(false);
  const [busy, setBusy] = useState<"check" | "claim" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"hold" | "reject" | null>(null);

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
      await librarianService.claimHandover(item.requestId, { copyBarcode: barcode.trim() });
      toast.success("Handover confirmed. The loan has started.");
      onChanged();
    } catch (e) {
      setError(describeError(e));
      setCheck(null); // eligibility may have changed: check again
    } finally {
      setBusy(null);
    }
  };

  const canConfirm = Boolean(check?.eligible) && idOk && copyOk && barcode.trim().length > 0;

  return (
    <Card title="Handover" note="Step 1: Check Penalties. Step 2: verify the student and the copy. Step 3: Confirm Handover.">
      <div className="stack">
        <div>
          <Button variant="ghost" onClick={runCheck} loading={busy === "check"}>
            Check Penalties
          </Button>
        </div>
        {check && <PenaltySummary check={check} />}

        <hr style={{ border: 0, borderTop: "1px solid var(--color-line)" }} />

        <CheckboxField label="I checked the student's ID against the name on this request." checked={idOk} onChange={(e) => setIdOk(e.target.checked)} />
        <CheckboxField label="The copy in my hand is in usable condition." checked={copyOk} onChange={(e) => setCopyOk(e.target.checked)} />
        <InputField
          label="Copy barcode"
          hint={`Scan or type the barcode of the assigned copy (${item.copy.barcode}).`}
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />

        {error && <Alert kind="error">{error}</Alert>}

        <div className="row-actions">
          <Button onClick={confirm} loading={busy === "claim"} disabled={!canConfirm}>
            Confirm Handover
          </Button>
          {item.status === "APPROVED" && (
            <Button variant="ghost" onClick={() => setDialog("hold")}>
              Place on Hold
            </Button>
          )}
          <Button variant="danger" onClick={() => setDialog("reject")}>
            Reject Handover
          </Button>
        </div>
        {!check && <p className="subtle">Confirm Handover unlocks after Check Penalties finds the student eligible.</p>}
      </div>

      {dialog === "hold" && (
        <ActionReasonDialog
          title="Place pickup on hold"
          intro="Use this for a resolvable issue. The copy stays assigned to the student."
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
          title="Reject handover"
          intro="Use this when the release cannot proceed. The copy is released and the student must request again."
          reasons={REJECT_REASONS}
          confirmLabel="Reject handover"
          danger
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