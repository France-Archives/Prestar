import type { Interest, UUID } from "@/types";
import { NS, uid } from "./mockHelpers";
import { STUDENT_ID } from "./mockUsers";

// TEMPORARY MOCK IMPLEMENTATION: fake reading interests and the interests each student selected.
// Replace with the real interests list (P1, TO CONFIRM) and student-interest records (S1, S3).
// Each student keeps exactly 3 distinct interests. Dan and Ella have none yet, which shows the onboarding prompt.

const NAMES = ["Psychology", "Fiction", "Computer Science", "Design", "Productivity", "History", "Literature", "Business", "Science", "Philosophy"];

export const MOCK_INTERESTS: Interest[] = NAMES.map((name, i) => ({ id: uid(NS.interest, i + 1), name }));
const i = (no: number): UUID => uid(NS.interest, no);

/** Keyed by students.id. */
export const MOCK_STUDENT_INTERESTS: Record<UUID, UUID[]> = {
  [STUDENT_ID.ana]: [i(3), i(5), i(1)],
  [STUDENT_ID.ben]: [i(3), i(4), i(2)],
  [STUDENT_ID.carla]: [i(7), i(6), i(2)],
  [STUDENT_ID.felix]: [i(9), i(6), i(10)],
  [STUDENT_ID.gina]: [i(9), i(1), i(8)],
};