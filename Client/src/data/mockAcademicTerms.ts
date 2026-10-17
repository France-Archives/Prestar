import type { AcademicTerm } from "@/types";
import { NS, uid } from "./mockHelpers";

// TEMPORARY MOCK IMPLEMENTATION: Replace with the real configured academic terms (D9 to D11, P17).
// Dates are configured by Admin, never hard-coded in the real system (TC-06).

export const TERM_ID = {
  past: uid(NS.term, 1),
  current: uid(NS.term, 2),
  next: uid(NS.term, 3),
} as const;

export const MOCK_ACADEMIC_TERMS: AcademicTerm[] = [
  {
    id: TERM_ID.past,
    name: "AY 2025-2026 · 2nd Semester",
    startDate: "2026-01-12",
    endDate: "2026-05-22",
    corDeadline: "2026-02-06",
    status: "COMPLETED",
  },
  {
    id: TERM_ID.current,
    name: "AY 2026-2027 · 1st Semester",
    startDate: "2026-08-03",
    endDate: "2026-12-18",
    corDeadline: "2026-10-30",
    status: "ACTIVE",
  },
  {
    id: TERM_ID.next,
    name: "AY 2026-2027 · 2nd Semester",
    startDate: "2027-01-11",
    endDate: "2027-05-21",
    corDeadline: "2027-02-05",
    status: "UPCOMING",
  },
];

export function termById(id: string): AcademicTerm {
  const t = MOCK_ACADEMIC_TERMS.find((x) => x.id === id);
  if (!t) throw new Error(`Seed term ${id} not found`);
  return t;
}
export const termNameOf = (id: string): string => termById(id).name;