import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Alert, { MockTag } from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import FileUpload from "@/components/forms/FileUpload";
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

// TEMPORARY MOCK: the chosen file is NOT uploaded or stored anywhere. The real backend stores it in private storage (S5, multipart).
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
    if (!file) return setFileError("Choose a file.");
    const problem = validateCorFile(file);
    setFileError(problem);
    if (problem) return;
    setBusy(true);
    try {
      await verificationService.submitCor({ academicTermId: chosen, file });
      toast.success("COR submitted. It is waiting for review.");
      navigate(ROUTES.student.cor);
    } catch (err) {
      setFormError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <PageHeader eyebrow="Account" title="Upload COR" description="Upload your Certificate of Registration (PDF, JPG or PNG). A newer pending upload for the same term replaces the older one." />
      <Card>
        <form className="stack" onSubmit={submit} noValidate>
          <Alert kind="warn"><MockTag>Simulated upload</MockTag> The file is not sent or stored in this demo. Only its name is kept.</Alert>
          <SelectField label="Academic term" value={chosen} onChange={(e) => setTermId(e.target.value)} required>
            {options.map((t) => (
              <option key={t.id} value={t.id}>{t.name} (COR deadline {formatDate(t.corDeadline)})</option>
            ))}
          </SelectField>
          <FileUpload label="COR file" file={file} onChange={(f) => { setFile(f); setFileError(null); }} error={fileError} hint="Allowed formats and the maximum size are TO CONFIRM (TC-04)." />
          {formError && <Alert kind="error">{formError}</Alert>}
          <div className="row-actions">
            <Button type="submit" loading={busy} disabled={!chosen}>Submit COR</Button>
            <Button variant="ghost" onClick={() => navigate(ROUTES.student.cor)}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}