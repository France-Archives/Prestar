import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Alert, { MockTag } from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import { SelectField } from "@/components/forms/FormField";
import LoadingState from "@/components/feedback/LoadingState";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import * as verificationService from "@/services/verificationService";
import { describeError } from "@/utils/errors";
import { formatDate } from "@/utils/formatDate";
import { validateCorFile } from "@/utils/validators";
import CorCameraCapture from "../components/CorCameraCapture";

// TEMPORARY MOCK: the captured photo is NOT uploaded or stored anywhere. The real backend stores it in private storage.
export default function UploadCORPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const terms = useAsync(() => verificationService.listAcademicTerms(), []);
  const [termId, setTermId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (terms.loading) return <div className="page"><LoadingState rows={3} /></div>;
  if (terms.error) return <div className="page"><ErrorState message={terms.error} onRetry={() => void terms.reload()} /></div>;

  // A COR is submitted for the current or the next term.
  const options = (terms.data ?? []).filter((t) => t.status === "ACTIVE" || t.status === "UPCOMING");
  const chosen = termId || options.find((t) => t.status === "ACTIVE")?.id || options[0]?.id || "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!file) return setFileError("Take a photo with your device camera first.");
    const problem = validateCorFile(file);
    setFileError(problem);
    if (problem) return;
    setBusy(true);
    try {
      // The COR is created as PENDING and still needs staff review.
      await verificationService.submitCor({ academicTermId: chosen, file });
      toast.success("COR submitted. It is waiting for review.");
      navigate(ROUTES.student.cor);
    } catch (err) {
      setFormError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <PageHeader eyebrow="Account" title="Submit COR" description="Use your device camera to take a real-time photo of your Certificate of Registration. A newer pending submission for the same term replaces the older one." />
      <Card>
        <form className="stack" onSubmit={submit} noValidate>
          <Alert kind="warn"><MockTag>Simulated capture</MockTag> The captured photo is not sent or stored in this demo. Only its file name is kept.</Alert>
          <Alert kind="info">A camera capture is only a submission. Library staff still review every COR, and you can borrow only after it is approved.</Alert>
          <SelectField label="Academic term" value={chosen} onChange={(e) => setTermId(e.target.value)} required>
            {options.map((t) => (
              <option key={t.id} value={t.id}>{t.name} (COR deadline {formatDate(t.corDeadline)})</option>
            ))}
          </SelectField>

          <CorCameraCapture
            disabled={busy}
            onCapture={(f) => {
              setFile(f);
              setFileError(null);
            }}
          />
          {fileError && <Alert kind="error">{fileError}</Alert>}

          {formError && <Alert kind="error">{formError}</Alert>}
          <div className="row-actions">
            <Button type="submit" loading={busy} disabled={!chosen}>Submit COR</Button>
            <Button variant="ghost" onClick={() => navigate(ROUTES.student.cor)} disabled={busy}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}