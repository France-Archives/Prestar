import type { BorrowingReportRow } from "@/types";
import { calendarDaysBetween, dateKey, formatDate, todayKey } from "@/utils/formatDate";

export type ReportGroup = "daily" | "weekly" | "monthly" | "yearly";
export type ReportPreset = "last7" | "last30" | "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear" | "custom";

export interface DateRange {
  from: string;
  to: string;
}

export interface ActivityBucket {
  date: string;
  loansIssued: number;
  returns: number;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function parts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function dateString(year: number, month: number, day: number) {
  const normalized = new Date(Date.UTC(year, month - 1, day));
  return `${normalized.getUTCFullYear()}-${String(normalized.getUTCMonth() + 1).padStart(2, "0")}-${String(normalized.getUTCDate()).padStart(2, "0")}`;
}

function shiftDate(value: string, days: number) {
  const { year, month, day } = parts(value);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return dateString(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

export function rangeForPreset(preset: ReportPreset, today = todayKey()): DateRange {
  const { year, month } = parts(today);
  const currentMonthStart = dateString(year, month, 1);

  switch (preset) {
    case "last7":
      return { from: shiftDate(today, -6), to: today };
    case "last30":
      return { from: shiftDate(today, -29), to: today };
    case "thisMonth":
      return { from: currentMonthStart, to: today };
    case "lastMonth": {
      const lastMonthEnd = shiftDate(currentMonthStart, -1);
      const { year: lastYear, month: lastMonth } = parts(lastMonthEnd);
      return { from: dateString(lastYear, lastMonth, 1), to: lastMonthEnd };
    }
    case "thisQuarter": {
      const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
      return { from: dateString(year, quarterStartMonth, 1), to: today };
    }
    case "thisYear":
      return { from: dateString(year, 1, 1), to: today };
    case "custom":
      return { from: "", to: "" };
  }
}

export function guessReportGroup(range: DateRange): ReportGroup {
  if (!range.from || !range.to || range.to < range.from) return "daily";
  const days = calendarDaysBetween(range.from, range.to) + 1;
  if (days <= 31) return "daily";
  if (days <= 120) return "weekly";
  if (days <= 730) return "monthly";
  return "yearly";
}

export function previousDateRange(range: DateRange): DateRange {
  if (!range.from || !range.to || range.to < range.from) return { from: "", to: "" };
  const length = calendarDaysBetween(range.from, range.to) + 1;
  const to = shiftDate(range.from, -1);
  return { from: shiftDate(to, -(length - 1)), to };
}

export function isWithinRange(value: string | null | undefined, range: DateRange): boolean {
  if (!value || !range.from || !range.to || range.to < range.from) return false;
  const key = dateKey(value);
  return key >= range.from && key <= range.to;
}

function bucketStart(value: string, group: ReportGroup): string {
  const { year, month, day } = parts(value);
  if (group === "yearly") return dateString(year, 1, 1);
  if (group === "monthly") return dateString(year, month, 1);
  if (group === "weekly") {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return shiftDate(value, -((weekday + 6) % 7));
  }
  return value;
}

function nextBucket(value: string, group: ReportGroup): string {
  const { year, month } = parts(value);
  if (group === "yearly") return dateString(year + 1, 1, 1);
  if (group === "monthly") return dateString(year, month + 1, 1);
  return shiftDate(value, group === "weekly" ? 7 : 1);
}

export function formatBucketLabel(value: string, group: ReportGroup): string {
  if (group === "daily") return DATE_FORMAT.format(new Date(`${value}T00:00:00Z`)).replace(/, \d{4}$/, "");
  if (group === "weekly") return `Week of ${formatDate(value).replace(/, \d{4}$/, "")}`;
  if (group === "monthly") {
    const { year, month } = parts(value);
    return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)));
  }
  return parts(value).year.toString();
}

export function buildActivityBuckets(
  rows: BorrowingReportRow[],
  range: DateRange,
  group: ReportGroup,
): ActivityBucket[] {
  if (!range.from || !range.to || range.to < range.from) return [];
  const first = bucketStart(range.from, group);
  const last = bucketStart(range.to, group);
  const buckets: ActivityBucket[] = [];
  const byDate = new Map<string, ActivityBucket>();

  for (let cursor = first; cursor <= last; cursor = nextBucket(cursor, group)) {
    const bucket = { date: cursor, loansIssued: 0, returns: 0 };
    buckets.push(bucket);
    byDate.set(cursor, bucket);
  }

  for (const row of rows) {
    if (isWithinRange(row.borrowedAt, range)) {
      const key = bucketStart(dateKey(row.borrowedAt), group);
      const bucket = byDate.get(key);
      if (bucket) bucket.loansIssued += 1;
    }
    if (isWithinRange(row.returnedAt, range)) {
      const key = bucketStart(dateKey(row.returnedAt as string), group);
      const bucket = byDate.get(key);
      if (bucket) bucket.returns += 1;
    }
  }
  return buckets;
}
