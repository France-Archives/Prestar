import { useState, type ReactNode } from "react";
import EmptyState from "@/components/feedback/EmptyState";
import { ROUTES } from "@/app/routeConfig";
import type { BookSummary } from "@/types";
import AvailabilityBadge from "./AvailabilityBadge";
import BookDetailsModal from "./BookDetailsModal";
import BookShelf, { type ShelfItem } from "./BookShelf";

interface BookGridProps {
  books: BookSummary[];
  emptyText?: string;
  layout?: "grid" | "row";
  /** Extra line per book id, shown above the availability (for example "42 loans"). */
  meta?: Record<string, ReactNode>;
  /** Show 1, 2, 3… on the covers. */
  ranked?: boolean;
}

// Every collection uses the same card, and clicking a book opens the same details modal.
export default function BookGrid({ books, emptyText = "No books match your search.", layout = "grid", meta, ranked = false }: BookGridProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (books.length === 0) return <EmptyState title={emptyText} text="Try different words or clear the filters." />;

  const items: ShelfItem[] = books.map((b, i) => ({
    id: b.id,
    title: b.title,
    subtitle: b.authors.map((a) => a.name).join(", ") || "Unknown author",
    coverUrl: b.coverImageUrl,
    href: ROUTES.student.bookDetails(b.id),
    rank: ranked ? i + 1 : undefined,
    caption: (
      <>
        {meta?.[b.id]}
        <AvailabilityBadge availability={b.availability} />
      </>
    ),
  }));
  const open = books.find((b) => b.id === openId);

  return (
    <>
      <BookShelf items={items} layout={layout} selectedId={openId} onSelect={(i) => setOpenId(i.id)} />
      {open && <BookDetailsModal bookId={open.id} title={open.title} onClose={() => setOpenId(null)} />}
    </>
  );
}