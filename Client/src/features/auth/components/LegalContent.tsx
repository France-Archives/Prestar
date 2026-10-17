import Alert from "@/components/feedback/Alert";

const LIST_STYLE = { paddingLeft: 20, display: "grid", gap: 8 } as const;

// DRAFT summary of the agreed borrowing rules. Final legal wording must come from the university.
export function TermsContent() {
  return (
    <div className="stack">
      <Alert kind="warn">Draft summary. Not legal text.</Alert>
      <ul style={LIST_STYLE}>
        <li>Only verified students with an approved COR for the current term may borrow, reserve or renew.</li>
        <li>Each student may hold up to 10 active commitments, and up to 2 for the same title.</li>
        <li>Loans and renewals last 3, 7, 14, 21, 30 or 60 days. Approved pickups are held for 3 days.</li>
        <li>A loan starts only when library staff confirm the handover.</li>
        <li>There is a 3-day overdue grace period. Borrowing is restricted when a loan is more than 3 days overdue.</li>
        <li>Damaged books cost ₱100 (minor) or ₱200 (major). A lost book costs ₱500. Fines are paid in person.</li>
      </ul>
    </div>
  );
}

// DRAFT. Final privacy wording and retention policy are TO CONFIRM (TC-18).
export function PrivacyContent() {
  return (
    <div className="stack">
      <Alert kind="warn">Draft summary. Not legal text.</Alert>
      <ul style={LIST_STYLE}>
        <li>We keep your account, borrowing history, reservations, fines and notifications to run the library.</li>
        <li>Your COR is stored in private storage and shown only to authorized reviewers.</li>
        <li>Passwords are never stored in readable form. Verification and reset links are single-use.</li>
        <li>Staff and administrator actions are recorded in an audit log.</li>
      </ul>
    </div>
  );
}