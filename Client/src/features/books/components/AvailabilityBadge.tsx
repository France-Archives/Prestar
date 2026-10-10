import type { BookAvailability } from "@/types";

export default function AvailabilityBadge({ availability }: { availability: BookAvailability }) {
  const { availableCopies, totalUsableCopies } = availability;
  if (totalUsableCopies === 0) return <span className="badge badge-neutral">No copies in circulation</span>;
  if (availableCopies > 0) {
    return (
      <span className="badge badge-ok">
        {availableCopies} of {totalUsableCopies} available
      </span>
    );
  }
  return <span className="badge badge-warn">All copies out · reserve</span>;
}