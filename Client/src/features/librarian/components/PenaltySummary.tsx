import Alert from "@/components/feedback/Alert";
import Money from "@/components/data-display/Money";
import StatusBadge from "@/components/data-display/StatusBadge";
import type { PenaltyCheck } from "@/types";
import { formatDate } from "@/utils/formatDate";

// Shows a live eligibility check. The result is computed by the backend (mock engine in this demo); the UI never decides eligibility.
export default function PenaltySummary({ check }: { check: PenaltyCheck }) {
  return (
    <div className="stack" style={{ gap: 12 }}>
      <Alert kind={check.eligible ? "ok" : "error"}>
        {check.eligible ? "Eligible: no restriction was found." : "Not eligible: a restriction applies."}{" "}
        <span className="subtle">Checked {formatDate(check.checkedAt)}</span>
      </Alert>
      <dl className="kv">
        <div><dt>Account</dt><dd><StatusBadge status={check.accountStatus} /></dd></div>
        <div><dt>Email verified</dt><dd>{check.emailVerified ? "Yes" : "No"}</dd></div>
        <div><dt>COR (current term)</dt><dd><StatusBadge status={check.corStatus} /></dd></div>
        <div><dt>Active commitments</dt><dd>{check.activeCommitmentCount}</dd></div>
      </dl>
      {check.reasons.length > 0 && (
        <div>
          <h3>Restrictions</h3>
          <ul style={{ paddingLeft: 18 }}>
            {check.reasons.map((r) => (
              <li key={r.code}>
                <b>{r.code}</b>: {r.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {check.overdueLoans.length > 0 && (
        <div>
          <h3>Overdue loans beyond the grace period</h3>
          <ul style={{ paddingLeft: 18 }}>
            {check.overdueLoans.map((l) => (
              <li key={l.loanId}>
                {l.bookTitle} · due {formatDate(l.dueAt)} · {l.overdueDays} days overdue
              </li>
            ))}
          </ul>
        </div>
      )}
      {check.unpaidFines.length > 0 && (
        <div>
          <h3>Unpaid fines</h3>
          <ul style={{ paddingLeft: 18 }}>
            {check.unpaidFines.map((f) => (
              <li key={f.fineId}>
                <StatusBadge status={f.fineType} /> <Money value={f.amount} /> · paid <Money value={f.paidAmount} /> · balance <Money value={f.balance} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}