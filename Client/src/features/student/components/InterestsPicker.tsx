import { useRef, useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Modal from "@/components/ui/Modal";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import * as authService from "@/services/authService";
import type { UUID } from "@/types";
import { interestUpdateError } from "../interestErrors";
import InterestSelector from "./InterestSelector";

interface Props {
  mode: "first-login" | "edit";
  initialSelection?: UUID[];
  onClose: () => void;
}

export default function InterestsPicker({ mode, initialSelection = [], onClose }: Props) {
  const toast = useToast();
  const { updateInterests } = useAuth();
  const options = useAsync(() => authService.listInterestOptions(), []);
  const [selected, setSelected] = useState<UUID[]>(initialSelection);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitting = useRef(false);
  const required = mode === "first-login";

  const save = async () => {
    if (selected.length === 0 || submitting.current || !options.data?.length) return;
    submitting.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await updateInterests({ interestIds: selected });
      toast.success(mode === "first-login" ? "Interests saved. Welcome!" : "Interests updated.");
      onClose();
    } catch (error) {
      setSaveError(interestUpdateError(error));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const title = required ? "What do you like to read?" : "Edit your interests";
  const footer = (
    <div className="interests-picker__actions">
      {!required && <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>}
      <Button data-modal-focus="confirm" onClick={() => void save()} loading={saving} disabled={saving || selected.length === 0 || options.loading || !options.data?.length}>
        {required ? "Continue" : "Save interests"}
      </Button>
      {selected.length === 0 && <span className="subtle">Choose at least one interest.</span>}
    </div>
  );

  return (
    <Modal
      title={title}
      onClose={required ? () => undefined : onClose}
      footer={footer}
      className={`interests-picker${required ? " interests-picker--required" : ""}`}
      closeBlocked={required || saving}
      initialFocus="confirm"
      wide
    >
      <p className="subtle">
        {required
          ? "Choose topics you enjoy. We’ll use them to recommend books."
          : "Update the topics used to personalize your book recommendations."}
      </p>
      {options.loading ? (
        <div className="interest-selector-skeleton" role="status" aria-label="Loading reading categories">
          <LoadingState rows={4} />
        </div>
      ) : options.error ? (
        <ErrorState message={options.error} onRetry={() => void options.reload()} />
      ) : !options.data?.length ? (
        <EmptyState title="No categories yet" text="There are no reading categories to choose from yet." />
      ) : (
        <>
          <InterestSelector interests={options.data} selected={selected} onChange={setSelected} />
          <p className="interests-picker__count" aria-live="polite">{selected.length} selected</p>
        </>
      )}
      {saveError && <Alert kind="error">{saveError}</Alert>}
    </Modal>
  );
}
