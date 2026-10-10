import Button from "@/components/common/Button";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import StatusBadge from "@/components/data-display/StatusBadge";
import type { StaffReservation } from "@/types";
import { formatDate } from "@/utils/formatDate";

interface ReservationQueueProps {
  rows: StaffReservation[];
  onClaim?: (r: StaffReservation) => void;
  empty?: string;
}

// Queue order is FIFO by reservedAt, then id. The position is computed by the backend.
export default function ReservationQueue({ rows, onClaim, empty = "No reservations here." }: ReservationQueueProps) {
  const columns: Column<StaffReservation>[] = [
    { key: "bookTitle", header: "Book" },
    { key: "student", header: "Student", render: (r) => `${r.student.firstName} ${r.student.lastName} (${r.student.studentNumber})` },
    { key: "queuePosition", header: "Position", render: (r) => (r.status === "WAITING" ? r.queuePosition : "—") },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "reservedAt", header: "Reserved", render: (r) => formatDate(r.reservedAt) },
    { key: "pickupDeadline", header: "Offer expires", render: (r) => (r.pickupDeadline ? formatDate(r.pickupDeadline) : "—") },
    { key: "offeredCopy", header: "Held copy", render: (r) => r.offeredCopy?.barcode ?? "—" },
  ];
  if (onClaim) {
    columns.push({
      key: "actions",
      header: "",
      render: (r) =>
        r.status === "OFFERED" ? (
          <Button size="sm" onClick={() => onClaim(r)}>
            Hand over
          </Button>
        ) : null,
    });
  }
  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} empty={empty} />;
}