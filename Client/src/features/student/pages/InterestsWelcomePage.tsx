import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import PageHero from "@/components/layout/PageHero";
import LoadingState from "@/components/feedback/LoadingState";
import { ROUTES } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";
import { useAsync } from "@/hooks/useAsync";
import * as authService from "@/services/authService";
import type { UUID } from "@/types";
import InterestSelector from "../components/InterestSelector";
import { interestUpdateError } from "../interestErrors";

export default function InterestsWelcomePage() {
  const navigate = useNavigate();
  const { updateInterests } = useAuth();
  const options = useAsync(() => authService.listInterestOptions(), []);
  const [selected, setSelected] = useState<UUID[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const continueToDashboard = async () => {
    if (selected.length === 0 || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateInterests({ interestIds: selected });
      navigate(ROUTES.student.dashboard, { replace: true });
    } catch (error) {
      setSaveError(interestUpdateError(error));
      setSaving(false);
    }
  };

  return (
    <div className="page interests-page">
      <PageHero
        eyebrow="Getting started"
        title="What do you like to read?"
        description="Choose any topics that interest you. We’ll use them to recommend books."
      />
      {options.loading ? (
        <div className="interest-selector-skeleton" role="status" aria-label="Loading reading categories">
          <LoadingState rows={4} />
        </div>
      ) : options.error ? (
        <ErrorState message={options.error} onRetry={() => void options.reload()} />
      ) : !options.data?.length ? (
        <EmptyState title="No categories yet" text="There are no reading categories to choose from yet." />
      ) : (
        <section className="card card-pad stack" aria-label="Choose reading interests">
          <InterestSelector interests={options.data} selected={selected} onChange={setSelected} />
          <p className="subtle" aria-live="polite">{selected.length} selected</p>
          {saveError && <Alert kind="error">{saveError}</Alert>}
          <div className="row-actions">
            <Button onClick={() => void continueToDashboard()} loading={saving} disabled={saving || selected.length === 0}>
              Continue
            </Button>
            {selected.length === 0 && <span className="subtle">Pick at least one.</span>}
          </div>
        </section>
      )}
    </div>
  );
}
