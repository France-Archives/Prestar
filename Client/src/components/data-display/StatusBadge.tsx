import { statusLabel } from "@/utils/constants";

type Tone = "ok" | "info" | "warn" | "danger" | "neutral";

const TONES: Record<string, Tone> = {
  ACTIVE: "ok", APPROVED: "ok", AVAILABLE: "ok", RETURNED: "ok", PAID: "ok", COLLECTED: "ok", CLAIMED: "ok",
  ACCEPTED: "ok", GOOD: "ok", NEW: "ok", COMPLETED: "ok", CASH: "ok",
  PENDING: "info", WAITING: "info", OFFERED: "info", UPCOMING: "info", PARTIALLY_PAID: "info", RESERVED: "info",
  ON_LOAN: "info", PENDING_VERIFICATION: "info", STUDENT: "info", LIBRARIAN: "info", ADMIN: "info", FAIR: "info",
  CHECKED: "info", OTHER_IN_PERSON: "info",
  ON_HOLD: "warn", PLACED_ON_HOLD: "warn", MAINTENANCE: "warn", SUPERSEDED: "warn", DAMAGED: "warn",
  NOT_YET_EFFECTIVE: "warn", SUSPENDED: "warn", MISSING: "warn",
  REJECTED: "danger", RELEASE_REJECTED: "danger", LOST: "danger", OVERDUE: "danger", UNPAID: "danger",
  EXPIRED: "danger", DISABLED: "danger", UNUSABLE: "danger",
  CANCELLED: "neutral", WAIVED: "neutral", WITHDRAWN: "neutral",
};

export default function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = TONES[status] ?? "neutral";
  return <span className={`badge badge-${tone}`}>{label ?? statusLabel(status)}</span>;
}