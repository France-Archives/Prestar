import type { BookCopy } from "@/types";

export function formatCopyLocation(
  copy: Pick<BookCopy, "section" | "shelfCode" | "levelOrRow" | "locationNotes" | "shelfLocation"> & { notes?: string | null },
): string {
  const fields = [copy.section, copy.shelfCode, copy.levelOrRow].filter(Boolean);
  const primary = fields.length ? fields.join(" / ") : copy.shelfLocation;
  const note = copy.locationNotes || copy.notes;
  if (!primary && !note) return "No shelf location recorded";
  if (!primary) return `No shelf location recorded — ${note}`;
  return note ? `${primary} — ${note}` : primary;
}
