import type { ReactNode } from "react";

type Tone = "pending" | "info" | "approved" | "unavailable" | "warn" | "neutral";

// Maps every status in the DB to one of the badge colors in styles.css.
const TONE: Record<string, Tone> = {
  Pending: "pending", Waiting: "pending",
  Approved: "info", Borrowed: "info", Matched: "info",
  Issued: "approved", Ready: "approved", Fulfilled: "approved", Returned: "approved", Paid: "approved", Active: "approved", Available: "approved", Good: "approved", OK: "approved",
  Rejected: "unavailable", Lost: "unavailable", Overdue: "unavailable", Unpaid: "unavailable", Penalty: "unavailable", Suspended: "unavailable",
  Unmatched: "warn", "Due soon": "warn", Maintenance: "warn", Damaged: "warn", "For Review": "warn", "Needs Info": "warn", "Not enrolled": "warn",
  Cancelled: "neutral", Expired: "neutral", Waived: "neutral", Inactive: "neutral", Archived: "neutral", Lifted: "neutral",
};

type BadgeProps = { status: string; children?: ReactNode };

export default function Badge({ status, children }: BadgeProps) {
  return <span className={`badge ${TONE[status] ?? "neutral"}`}>{children ?? status}</span>;
}