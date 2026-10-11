import StatusBadge from "@/components/data-display/StatusBadge";
import type { BorrowingRequest } from "@/types";
import { formatDate } from "@/utils/formatDate";

const NOTE: Record<string, string> = {
  APPROVED: "A copy is held for you. Pick it up at the library before the deadline. This is not a loan yet.",
  ON_HOLD: "Staff placed your pickup on hold. Contact the library to resolve the issue.",
  RELEASE_REJECTED: "The library could not release this copy. You may request the book again.",
  CLAIMED: "Handed over. See it under My loans.",
  EXPIRED: "The pickup deadline passed and the copy was released.",
  CANCELLED: "This request was cancelled.",
  PENDING: "Waiting for a decision.",
};

interface Props {
  request: BorrowingRequest;
  onCancel?: (r: BorrowingRequest) => void;
}

export default function RequestStatusCard({ request: r, onCancel }: Props) {
  const cancellable = r.status === "APPROVED" || r.status === "ON_HOLD" || r.status === "PENDING";
  return (
    <article className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3>{r.bookTitle}</h3>
        <StatusBadge status={r.status} />
      </div>
      <p className="subtle">
        Requested {formatDate(r.requestedAt)} · {r.requestedDurationDays}-day loan
        {r.pickupDeadline && (r.status === "APPROVED" || r.status === "ON_HOLD") ? ` · Pick up by ${formatDate(r.pickupDeadline)}` : ""}
      </p>
      <p>{NOTE[r.status]}</p>
      {r.decisionReason && <p className="subtle">Note: {r.decisionReason}</p>}
      {cancellable && onCancel && (
        <div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCancel(r)}>
            Cancel request
          </button>
        </div>
      )}
    </article>
  );
}