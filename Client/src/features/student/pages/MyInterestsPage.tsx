import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import * as authService from "@/services/authService";
import type { UUID } from "@/types";
import { describeError } from "@/utils/errors";
import InterestSelector from "../components/InterestSelector";

export default function MyInterestsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const all = useAsync(() => authService.listInterests(), []);
  const profile = useAsync(() => authService.getMyProfile(), []);
  const [selected, setSelected] = useState<UUID[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile.data) setSelected(profile.data.interests.map((i) => i.id));
  }, [profile.data]);

  if (all.loading || profile.loading) return <div className="page"><LoadingState rows={3} /></div>;
  if (all.error || profile.error) return <div className="page"><ErrorState message={all.error ?? profile.error ?? ""} onRetry={() => { void all.reload(); void profile.reload(); }} /></div>;

  const save = async () => {
    if (selected.length !== 3) {
      setError("Choose exactly 3 interests.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authService.updateMyInterests({ interestIds: selected as [UUID, UUID, UUID] });
      toast.success("Interests saved.");
      navigate(ROUTES.student.dashboard);
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <PageHeader eyebrow="Student" title="My interests" description="Pick exactly 3 topics. We use them to recommend books." />
      <Card>
        <div className="stack">
          <InterestSelector interests={all.data ?? []} selected={selected} onChange={setSelected} />
          <p className="subtle">{selected.length} of 3 selected</p>
          {error && <Alert kind="error">{error}</Alert>}
          <div className="row-actions">
            <Button onClick={save} loading={busy} disabled={selected.length !== 3}>Save interests</Button>
            <Button variant="ghost" onClick={() => navigate(ROUTES.student.dashboard)}>Cancel</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}