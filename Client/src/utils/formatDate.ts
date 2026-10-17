import { TIME_ZONE } from "@/utils/constants";

// Display helpers. Timestamps are ISO 8601 UTC; calendar dates are YYYY-MM-DD.
// Everything is shown in Asia/Manila. Server-owned business rules (due dates, deadlines) are NOT decided here;
// the date arithmetic below exists for display and for the mock services only.

const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "short", day: "numeric" });
const dateOnlyFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

type DateInput = string | Date | null | undefined;

const toDate = (v: string | Date): Date => (v instanceof Date ? v : new Date(v));
const valid = (d: Date) => !Number.isNaN(d.getTime());

/** Oct 10, 2026 */
export function formatDate(v: DateInput): string {
  if (!v) return "—";
  if (typeof v === "string" && DATE_ONLY.test(v)) return dateOnlyFmt.format(new Date(`${v}T00:00:00Z`));
  const d = toDate(v);
  return valid(d) ? dateFmt.format(d) : "—";
}

/** Oct 10, 2026, 11:16 AM */
export function formatDateTime(v: DateInput): string {
  if (!v) return "—";
  const d = toDate(v);
  return valid(d) ? dateTimeFmt.format(d) : "—";
}

/** 11:16 AM */
export function formatTime(v: DateInput): string {
  if (!v) return "—";
  const d = toDate(v);
  return valid(d) ? timeFmt.format(d) : "—";
}

/** Manila calendar date key (YYYY-MM-DD) for a timestamp. Date-only strings pass through. */
export function dateKey(v: string | Date): string {
  if (typeof v === "string" && DATE_ONLY.test(v)) return v;
  return keyFmt.format(toDate(v));
}

/** Today in Asia/Manila as YYYY-MM-DD. */
export const todayKey = (now: Date = new Date()): string => keyFmt.format(now);

/** Value for an <input type="date"> from a timestamp or date. */
export const toDateInputValue = (v: DateInput): string => (v ? dateKey(v) : "");

/** Whole calendar days from a to b (b - a), in Manila calendar days. Negative if b is earlier. */
export function calendarDaysBetween(a: string | Date, b: string | Date): number {
  const [ay, am, ad] = dateKey(a).split("-").map(Number);
  const [by, bm, bd] = dateKey(b).split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

/** Calendar days past dueAt (0 if not late). Used for the 3-day grace display. */
export function overdueDays(dueAt: string, now: Date = new Date()): number {
  return Math.max(0, calendarDaysBetween(dueAt, now));
}

/** Calendar days until a deadline (negative once passed). */
export const daysUntil = (iso: string, now: Date = new Date()): number => calendarDaysBetween(now, iso);

export const isPast = (iso: string | null | undefined, now: Date = new Date()): boolean =>
  !!iso && new Date(iso).getTime() < now.getTime();

/**
 * now + N x 24h as an ISO UTC string.
 * MOCK ONLY. The real rule (N x 24h vs end of Manila day) is TO CONFIRM (TC-14) and is decided by the backend.
 */
export const addDaysIso = (iso: string | Date, days: number): string =>
  new Date(toDate(iso).getTime() + days * DAY_MS).toISOString();

/** "in 2 days", "today", "3 days ago". */
export function relativeDays(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const n = calendarDaysBetween(now, iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}