import Alert from "@/components/feedback/Alert";
import type { Loan } from "@/types";
import { daysUntil, formatDate } from "@/utils/formatDate";

// Display only. The backend decides the real restriction (more than 3 calendar days overdue blocks new borrowing).
export default function DueDateAlert({ loans }: { loans: Loan[] }) {
  const active = loans.filter((l) => l.status === "ACTIVE");
  const overdue = active.filter((l) => daysUntil(l.dueAt) < 0);
  const restricted = overdue.filter((l) => -daysUntil(l.dueAt) > 3);
  const soon = active.filter((l) => {
    const d = daysUntil(l.dueAt);
    return d >= 0 && d <= 2;
  });
  if (!overdue.length && !soon.length) return null;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {restricted.length > 0 && (
        <Alert kind="error">
          {restricted.length === 1 ? "A loan is" : `${restricted.length} loans are`} more than 3 days overdue, so new borrowing, reservations and renewals are blocked until you return {restricted.length === 1 ? "it" : "them"}.
        </Alert>
      )}
      {overdue.filter((l) => !restricted.includes(l)).map((l) => (
        <Alert key={l.id} kind="warn">
          {l.bookTitle} was due {formatDate(l.dueAt)}. You are inside the 3-day grace period. Return it soon.
        </Alert>
      ))}
      {soon.map((l) => (
        <Alert key={l.id} kind="info">
          {l.bookTitle} is due on {formatDate(l.dueAt)}.
        </Alert>
      ))}
    </div>
  );
}