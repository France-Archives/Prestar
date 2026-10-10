import Alert from "@/components/feedback/Alert";

// DRAFT. Final privacy wording and retention policy are TO CONFIRM (TC-18).
export default function PrivacyPage() {
  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <h1>Privacy</h1>
      <div className="stack" style={{ marginTop: 16 }}>
        <Alert kind="warn">Draft summary. Not legal text.</Alert>
        <ul style={{ paddingLeft: 20, display: "grid", gap: 8 }}>
          <li>We keep your account, borrowing history, reservations, fines and notifications to run the library.</li>
          <li>Your COR is stored in private storage and shown only to authorized reviewers.</li>
          <li>Passwords are never stored in readable form. Verification and reset links are single-use.</li>
          <li>Staff and administrator actions are recorded in an audit log.</li>
        </ul>
      </div>
    </div>
  );
}