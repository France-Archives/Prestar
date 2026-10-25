import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/common/Button";
import Alert from "@/components/feedback/Alert";
import InterestsPicker from "./InterestsPicker";

export default function StudentInterestsPrompt() {
  const { user, interests, interestsStatus, interestsError, refreshInterests } = useAuth();

  if (user?.role !== "STUDENT") return null;
  if (interestsStatus === "loaded" && interests?.length === 0) {
    return <InterestsPicker mode="first-login" onClose={() => undefined} />;
  }
  if (interestsStatus === "error") {
    return (
      <div className="student-interests-error" role="alert">
        <Alert kind="error">{interestsError ?? "Could not load your reading interests."}</Alert>
        <Button onClick={() => void refreshInterests()}>Retry</Button>
      </div>
    );
  }
  return null;
}
