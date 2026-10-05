const DAY = 864e5;
const pad = (n: number) => String(n).padStart(2, "0");
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// DATETIME values are ISO strings. DATE values (due_date, end_date) are "YYYY-MM-DD".
export const nowIso = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY).toISOString();
export const todayStr = (offsetDays = 0) => toDateStr(new Date(Date.now() + offsetDays * DAY));
export const addDaysToDate = (dateStr: string, n: number) => {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
};

// Days late as of today (0 if not late). Used for the days_overdue snapshot.
export const daysOverdue = (dueStr: string) => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((t.getTime() - parseDate(dueStr).getTime()) / DAY));
};
export const daysUntil = (dueStr: string) => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((parseDate(dueStr).getTime() - t.getTime()) / DAY);
};

const asDate = (v: string) => (v.length === 10 ? parseDate(v) : new Date(v));
export const fmtDate = (v: string | null | undefined) =>
  v ? asDate(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
export const fmtDateTime = (v: string | null | undefined) =>
  v ? asDate(v).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";