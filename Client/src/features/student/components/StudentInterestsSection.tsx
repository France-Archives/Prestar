import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import Card from "@/components/ui/Card";
import LoadingState from "@/components/feedback/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import InterestsPicker from "./InterestsPicker";

export default function StudentInterestsSection() {
  const { user, interests, interestsStatus, interestsError, refreshInterests } = useAuth();
  const [editing, setEditing] = useState(false);

  if (user?.role !== "STUDENT") return null;
  return (
    <>
      <Card title="Interests" actions={
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={interestsStatus !== "loaded"}>
          Edit interests
        </Button>
      }>
        {interestsStatus === "loading" ? <LoadingState rows={1} /> : interestsStatus === "error" ? (
          <div className="stack">
            <Alert kind="error">{interestsError ?? "Could not load your interests."}</Alert>
            <Button variant="ghost" size="sm" onClick={() => void refreshInterests()}>Retry</Button>
          </div>
        ) : !interests?.length ? <p className="subtle">No interests chosen yet.</p> : (
          <div className="student-interests-badges">
            {interests.map((interest) => <span key={interest.id} className="badge badge-ok">{interest.name}</span>)}
          </div>
        )}
      </Card>
      {editing && <InterestsPicker
        key={`edit-interests-${interests?.map((interest) => interest.id).join("-") ?? ""}`}
        mode="edit"
        initialSelection={interests?.map((interest) => interest.id) ?? []}
        onClose={() => setEditing(false)}
      />}
    </>
  );
}
