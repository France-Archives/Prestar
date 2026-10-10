import Alert from "@/components/feedback/Alert";

// DRAFT summary of the agreed borrowing rules. Final legal wording must come from the university.
export default function TermsPage() {
  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <h1>Terms of use</h1>
      <div className="stack" style={{ marginTop: 16 }}>
        <Alert kind="warn">Draft summary. Not legal text.</Alert>
        <ul style={{ paddingLeft: 20, display: "grid", gap: 8 }}>
          <li>Only verified students with an approved COR for the current term may borrow, reserve or renew.</li>
          <li>Each student may hold up to 10 active commitments, and up to 2 for the same title.</li>
          <li>Loans and renewals last 3, 7, 14, 21, 30 or 60 days. Approved pickups are held for 3 days.</li>
          <li>A loan starts only when library staff confirm the handover.</li>
          <li>There is a 3-day overdue grace period. Borrowing is restricted when a loan is more than 3 days overdue.</li>
          <li>Damaged books cost ₱100 (minor) or ₱200 (major). A lost book costs ₱500. Fines are paid in person.</li>
        </ul>
      </div>
    </div>
  );
}