import { useEffect, useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import * as authService from "@/services/authService";
import type { UUID } from "@/types";
import { interestUpdateError } from "../interestErrors";
import InterestSelector from "../components/InterestSelector";

export default function MyInterestsPage() {
  const toast = useToast();
  const { interests, interestsStatus, updateInterests } = useAuth();
  const all = useAsync(() => authService.listInterestOptions(), []);
  const [selected, setSelected] = useState<UUID[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (interestsStatus === "loaded" && interests) setSelected(interests.map((i) => i.id));
  }, [interests, interestsStatus]);

  if (all.loading || interestsStatus === "loading") return <div className="page"><LoadingState rows={3} /></div>;
  if (all.error) return <div className="page"><ErrorState message={all.error} onRetry={() => void all.reload()} /></div>;
  if (!all.data?.length) return <div className="page"><PageHero eyebrow="Student" title="My interests" /><EmptyState title="No categories yet" text="There are no reading categories to choose from yet." /></div>;

  const save = async () => {
    if (selected.length === 0) {
      setError("Pick at least one.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateInterests({ interestIds: selected });
      toast.success("Interests saved.");
    } catch (e) {
      setError(interestUpdateError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <PageHero eyebrow="Student" title="My interests" description="Choose the topics you enjoy. We use them to recommend books." leading={<BackButton fallback={ROUTES.student.dashboard} />} />
      <Card>
        <div className="stack">
          <InterestSelector interests={all.data} selected={selected} onChange={setSelected} />
          <p className="subtle" aria-live="polite">{selected.length} selected</p>
          {error && <Alert kind="error">{error}</Alert>}
          <div className="row-actions">
            <Button onClick={save} loading={busy} disabled={busy || selected.length === 0}>Save interests</Button>
            {selected.length === 0 && <span className="subtle">Pick at least one.</span>}
          </div>
        </div>
      </Card>
    </div>
  );
}