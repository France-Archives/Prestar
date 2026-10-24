import { useState } from "react";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import EmptyState from "@/components/feedback/EmptyState";
import { SelectField } from "@/components/forms/FormField";
import StatusBadge from "@/components/data-display/StatusBadge";
import { useToast } from "@/hooks/useToast";
import * as renewalsService from "@/services/renewalsService";
import type { AllowedDurationDays, Loan } from "@/types";
import { daysUntil, formatDate } from "@/utils/formatDate";

const DURATIONS: AllowedDurationDays[] = [3, 7, 14, 21, 30, 60];

interface Props {
  loans: Loan[];
  onChanged?: () => void;
  /** Hide renew buttons (dashboard summary). */
  compact?: boolean;
}

// The backend decides if a renewal is allowed (eligibility, nobody waiting, renewal limit). Its answer is shown as-is.
export default function MyActiveLoans({ loans, onChanged, compact = false }: Props) {
  const toast = useToast();
  const [target, setTarget] = useState<Loan | null>(null);
  const [duration, setDuration] = useState<AllowedDurationDays>(7);

  if (loans.length === 0) return <EmptyState title="No active loans" text="Browse the catalog to request a book." />;

  const renew = async () => {
    if (!target) return;
    const res = await renewalsService.createRenewal(target.id, { requestedDurationDays: duration });
    if (res.status === "APPROVED") toast.success(`Renewed. New due date: ${res.newDueAt ? formatDate(res.newDueAt) : "updated"}.`);
    else toast.info(`Renewal not approved: ${res.decisionReason ?? "see the library."}`);
    onChanged?.();
  };

  return (
    <>
      <ul className="stack" style={{ padding: 0, listStyle: "none", gap: 10 }}>
        {loans.map((l) => {
          const left = daysUntil(l.dueAt);
          return (
            <li key={l.id} className="card card-pad" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", borderLeft: left < 0 ? "4px solid var(--color-brick)" : undefined }}>
              <div>
                <strong style={{ color: "var(--color-forest)" }}>{l.bookTitle}</strong>
                <p className="subtle">
                  Copy {l.copyBarcode} · Borrowed {formatDate(l.borrowedAt)} · Due {formatDate(l.dueAt)} · Renewed {l.renewedCount}×
                </p>
                <span className={`badge ${left < 0 ? "badge-danger" : left <= 2 ? "badge-warn" : "badge-ok"}`}>
                  {left >= 0 ? `${left} day${left === 1 ? "" : "s"} left` : `${-left} day${left === -1 ? "" : "s"} overdue`}
                </span>{" "}
                <StatusBadge status={l.status} />
              </div>
              {!compact && (
                <Button variant="ghost" size="sm" onClick={() => { setTarget(l); setDuration(7); }}>
                  Renew
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {target && (
        <ConfirmDialog title={`Renew ${target.bookTitle}`} confirmLabel="Request renewal" onConfirm={renew} onClose={() => setTarget(null)}>
          <SelectField label="Renewal duration" value={duration} onChange={(e) => setDuration(Number(e.target.value) as AllowedDurationDays)}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </SelectField>
          <p className="subtle">The new due date is counted from the approval date. Renewals are decided automatically and are rejected when another student is waiting for this title.</p>
        </ConfirmDialog>
      )}
    </>
  );
}