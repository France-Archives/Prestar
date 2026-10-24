import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Alert, { MockTag } from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import FileUpload from "@/components/forms/FileUpload";
import { SelectField } from "@/components/forms/FormField";
import LoadingState from "@/components/feedback/LoadingState";
import Tabs from "@/components/ui/Tabs";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import * as verificationService from "@/services/verificationService";
import { USE_MOCKS } from "@/utils/constants";
import { describeError } from "@/utils/errors";
import { formatDate } from "@/utils/formatDate";
import { validateCorFile } from "@/utils/validators";
import CorCameraCapture from "../components/CorCameraCapture";

type Source = "camera" | "file";

// Mock mode stores only a filename. The live API also persists only a filename; it has no document-upload contract.
// A photo from the camera is just a File (JPEG), so it follows exactly the same validation and submission as an uploaded file.
export default function UploadCORPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const terms = useAsync(() => verificationService.listAcademicTerms(), []);
  const [termId, setTermId] = useState("");
  const [source, setSource] = useState<Source>("camera");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (terms.loading) return <div className="page"><LoadingState rows={3} /></div>;
  if (terms.error) return <div className="page"><ErrorState message={terms.error} onRetry={() => void terms.reload()} /></div>;

  // A COR is submitted for the current or the next term.
  const options = (terms.data ?? []).filter((t) => USE_MOCKS
    ? t.status === "ACTIVE" || t.status === "UPCOMING"
    : t.status === "ACTIVE");
  const chosen = termId || options.find((t) => t.status === "ACTIVE")?.id || options[0]?.id || "";

  // Switching tabs clears the file, so a photo can never be submitted by accident from the other tab.
  // (Leaving the camera tab also unmounts the camera component, which stops the camera stream.)
  const switchSource = (next: Source) => {
    setSource(next);
    setFile(null);
    setFileError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!file) return setFileError(source === "camera" ? "Take a photo first." : "Choose a file.");
    const problem = validateCorFile(file);
    setFileError(problem);
    if (problem) return;
    setBusy(true);
    try {
      // Same call for a photo and for an uploaded file. The COR is created as PENDING and still needs staff review.
      const submitted = await verificationService.submitCor({ academicTermId: chosen, file });
      toast.success(`COR submitted${submitted.termName ? ` for ${submitted.termName}` : ""}. It is waiting for review.`);
      navigate(ROUTES.student.cor);
    } catch (err) {
      setFormError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <PageHero eyebrow="Account" title="Submit COR" description="Take a realtime photo of your Certificate of Registration using your camera. Only genuine captured images (JPG, PNG, WebP) are accepted for verification." leading={<BackButton fallback={ROUTES.student.dashboard} />} />
      <Card>
        <form className="stack" onSubmit={submit} noValidate>
          {USE_MOCKS ? (
            <Alert kind="warn"><MockTag>Simulated upload</MockTag> The file is not stored in this demo.</Alert>
          ) : (
            <Alert kind="info">Your captured COR photo will be securely uploaded and stored in private storage for library staff review.</Alert>
          )}
          <Alert kind="info">A photo is a submission. Library staff still review every COR, and you can borrow books once approved.</Alert>
          {USE_MOCKS ? (
            <SelectField label="Academic term" value={chosen} onChange={(e) => setTermId(e.target.value)} required>
              {options.map((t) => (
                <option key={t.id} value={t.id}>{t.name} (COR deadline {formatDate(t.corDeadline)})</option>
              ))}
            </SelectField>
          ) : (
            <Alert kind="info">
              The Server assigns the submission to the current academic term.
              {options[0] ? ` Current term: ${options[0].name}.` : ""}
            </Alert>
          )}

          <Tabs<Source> tabs={[{ key: "camera", label: "Camera Photo" }, { key: "file", label: "Upload Image" }]} active={source} onChange={switchSource} />

          {source === "camera" ? (
            <>
              <CorCameraCapture
                disabled={busy}
                onCapture={(f) => {
                  setFile(f);
                  setFileError(null);
                }}
              />
              {fileError && <Alert kind="error">{fileError}</Alert>}
            </>
          ) : (
            <FileUpload label="COR image" file={file} onChange={(f) => { setFile(f); setFileError(null); }} error={fileError} hint="Only genuine captured images (JPG, PNG, WebP) up to 10MB are accepted. PDFs are not allowed." />
          )}

          {formError && <Alert kind="error">{formError}</Alert>}
          <div className="row-actions">
            <Button type="submit" loading={busy} disabled={busy || (USE_MOCKS && !chosen)}>Submit COR</Button>
            <Button variant="ghost" onClick={() => navigate(ROUTES.student.cor)} disabled={busy}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}