import StatusBadge from "@/components/data-display/StatusBadge";
import type { Reservation } from "@/types";
import { formatDate } from "@/utils/formatDate";

interface Props {
  reservation: Reservation;
  onCancel?: (r: Reservation) => void;
}

export default function ReservationStatus({ reservation: r, onCancel }: Props) {
  const open = r.status === "WAITING" || r.status === "OFFERED";
  return (
    <article className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 6, borderLeft: r.status === "OFFERED" ? "4px solid var(--color-amber)" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3>{r.bookTitle}</h3>
        <StatusBadge status={r.status} />
      </div>
      <p className="subtle">Reserved {formatDate(r.reservedAt)}</p>
      {r.status === "WAITING" && <p>Your place in the queue: <b>{r.queuePosition ?? "—"}</b>. We notify you when a copy is offered.</p>}
      {r.status === "OFFERED" && (
        <p>A copy is held for you{r.pickupDeadline ? ` until ${formatDate(r.pickupDeadline)}` : ""}. Collect it at the library before the offer expires.</p>
      )}
      {r.status === "EXPIRED" && <p className="subtle">The offer was not collected in time and was passed on.</p>}
      {r.status === "COLLECTED" && <p className="subtle">Collected. See it under My loans.</p>}
      {open && onCancel && (
        <div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCancel(r)}>
            Cancel reservation
          </button>
        </div>
      )}
    </article>
  );
}