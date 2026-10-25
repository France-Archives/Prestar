import type { BookAvailability } from "@/types";

export default function AvailabilityBadge({ availability }: { availability: BookAvailability }) {
  const { availableCopies, totalUsableCopies } = availability;
  if (availableCopies > 0) {
    return (
      <span className="badge badge-ok">
        {availableCopies} of {totalUsableCopies} available
      </span>
    );
  }
  return <span className="badge badge-warn">Unavailable · reserve</span>;
}