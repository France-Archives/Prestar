import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../components/Logo";
import { useLibrary } from "../context/LibraryContext";
import { useBusy } from "../hooks/useBusy";
import * as api from "../services/api";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "application/pdf"];

export default function VerifyEmail() {
  const { act, notify } = useLibrary(); // useLibrary also re-renders this page when the mock db changes
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");
  const ref = params.get("ref");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, wrap] = useBusy();

  // MOCK REGISTRATION — the real link carries a signed expiring token; here the token is the reference number.
  useEffect(() => {
    if (!token) return;
    let live = true;
    api.verifyEmail(token).then((r) => {
      if (live && !r.ok) setVerifyError(r.error);
    });
    return () => {
      live = false;
    };
  }, [token]);

  const signup = token ? api.getSignupByReference(token) : null;

  const upload = wrap(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    const input = e.currentTarget.elements.namedItem("proof") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return setFileError("Choose a file.");
    if (!TYPES.includes(file.type)) return setFileError("Only JPG, PNG or PDF files.");
    if (file.size > MAX_BYTES) return setFileError("File must be 5 MB or smaller.");
    setFileError(null);
    await act(api.uploadProof(token, file.name), "Proof uploaded.");
  });

  let body;
  if (!token) {
    body = (
      <>
        <h1>Check your email</h1>
        <p>We sent a verification link to your school email.</p>
        {ref && <p className="ref">Application reference: <b>{ref}</b></p>}
        {/* MOCK — in the real system the student clicks the link in the email */}
        <button className="btn primary" onClick={() => navigate(`/verify-email?token=${ref}`)}>Open verification link (demo)</button>
        <button className="text-btn" onClick={() => notify("Verification email sent again (mock).")}>Resend verification email</button>
      </>
    );
  } else if (verifyError || !signup) {
    body = (
      <>
        <h1>Link problem</h1>
        <p>{verifyError ?? "This link has expired or is invalid."}</p>
        <button className="btn primary" onClick={() => notify("Verification email sent again (mock).")}>Resend verification email</button>
      </>
    );
  } else if (signup.status === "Approved") {
    body = (
      <>
        <h1>Email verified</h1>
        <p>Your account is ready.</p>
        <Link className="btn primary" to="/login">Log in</Link>
      </>
    );
  } else if (signup.status === "For Review") {
    body = (
      <>
        <h1>Under review</h1>
        <p>Your application <b>{signup.reference_no}</b> is being reviewed by the library.</p>
        <Link className="btn ghost" to="/login">Back to login</Link>
      </>
    );
  } else if (signup.status === "Rejected") {
    body = (
      <>
        <h1>Application rejected</h1>
        <p>{signup.remarks}</p>
        <Link className="btn ghost" to="/signup">Submit a new application</Link>
      </>
    );
  } else if (!signup.email_verified_at) {
    body = <h1>Verifying…</h1>;
  } else {
    // Unmatched applicant: proof upload (Pending) or resubmission (Needs Info)
    body = (
      <>
        <h1>{signup.status === "Needs Info" ? "More information needed" : "Email verified"}</h1>
        <p>{signup.status === "Needs Info" ? signup.remarks : "Upload your COR or school ID to continue."}</p>
        <form className="proof" onSubmit={upload}>
          <input type="file" name="proof" accept=".jpg,.jpeg,.png,.pdf" />
          {fileError && <p className="form-error">{fileError}</p>}
          <button className="btn primary" disabled={busy}>{busy ? "Uploading…" : "Submit proof"}</button>
        </form>
      </>
    );
  }

  return (
    <main className="auth-page">
      <header className="auth-top"><Logo /></header>
      <div className="plain-card">{body}</div>
    </main>
  );
}