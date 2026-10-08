import type { ReactNode } from "react";

type Tone = "pending" | "info" | "approved" | "unavailable" | "warn" | "neutral";

// Maps every status in the DB to one of the badge tones below.
const TONE: Record<string, Tone> = {
  Pending: "pending", Waiting: "pending",
  Approved: "info", Borrowed: "info", Matched: "info",
  Issued: "approved", Ready: "approved", Fulfilled: "approved", Returned: "approved", Paid: "approved", Active: "approved", Available: "approved", Good: "approved", OK: "approved",
  Rejected: "unavailable", Lost: "unavailable", Overdue: "unavailable", Unpaid: "unavailable", Penalty: "unavailable", Suspended: "unavailable",
  Unmatched: "warn", "Due soon": "warn", Maintenance: "warn", Damaged: "warn", "For Review": "warn", "Needs Info": "warn", "Not enrolled": "warn",
  Cancelled: "neutral", Expired: "neutral", Waived: "neutral", Inactive: "neutral", Archived: "neutral", Lifted: "neutral",
};

const TONE_CLASS: Record<Tone, string> = {
  approved: "bg-[#E4ECDF] text-[#0B3D32] border-[#C9D8C4]",
  pending: "bg-[#FBFAF5] text-[#0B3D32] border-[#6F9B78]",
  warn: "bg-[#F6ECD5] text-[#7A5A1C] border-[#E6D3A3]",
  unavailable: "bg-[#F1DDD6] text-[#8A3B35] border-[#E6C7BD]",
  neutral: "bg-[#ECECE6] text-[#6B756F] border-[#DCDACD]",
  info: "bg-[#DFE9EE] text-[#2F566B] border-[#C3D4DD]",
};

type BadgeProps = { status: string; children?: ReactNode };

export default function Badge({ status, children }: BadgeProps) {
  const tone = TONE[status] ?? "neutral";
  return (
    <span
      className={`badge ${tone} inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-[3px] font-sans text-[11px] font-bold leading-none tracking-[0.04em] ${TONE_CLASS[tone]}`}
    >
      {children ?? status}
    </span>
  );
}