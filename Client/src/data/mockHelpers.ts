import type { ISODateTime, UUID } from "@/types";

// TEMPORARY MOCK IMPLEMENTATION: development-only helpers. Delete with the data/ folder when the backend is connected.

/** Id namespaces, so every mock UUID is unique and readable in debugging. */
export const NS = {
  user: 1,
  student: 2,
  librarian: 3,
  book: 4,
  author: 5,
  category: 6,
  copy: 7,
  request: 8,
  loan: 9,
  reservation: 10,
  renewal: 11,
  verification: 12,
  fine: 13,
  payment: 14,
  notification: 15,
  interest: 16,
  term: 17,
  attempt: 18,
} as const;

const hex = (n: number, len: number) => n.toString(16).padStart(len, "0");

/** Deterministic, valid-format UUID (v4 layout) for mock records. Real ids come from the database. */
export const uid = (ns: number, n: number): UUID => `${hex(ns, 8)}-0000-4000-8000-${hex(n, 12)}`;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** ISO UTC timestamp relative to now: at(-3) = three days ago, at(2, 4) = in 2 days and 4 hours. */
export const at = (days: number, hours = 0): ISODateTime => new Date(Date.now() + days * DAY_MS + hours * HOUR_MS).toISOString();