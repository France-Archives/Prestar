import { useState } from "react";
import EmptyState from "@/components/feedback/EmptyState";
import { ROUTES } from "@/app/routeConfig";
import type { BookSummary } from "@/types";
import AvailabilityBadge from "./AvailabilityBadge";
import BookDetailsModal from "./BookDetailsModal";
import BookShelf, { type ShelfItem } from "./BookShelf";

// Books are shown standing on shelves. Clicking a book opens the same details modal the cards used.
export default function BookGrid({ books, emptyText = "No books match your search." }: { books: BookSummary[]; emptyText?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (books.length === 0) return <EmptyState title={emptyText} text="Try different words or clear the filters." />;

  const items: ShelfItem[] = books.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.authors.map((a) => a.name).join(", ") || "Unknown author",
    coverUrl: b.coverImageUrl,
    href: ROUTES.student.bookDetails(b.id),
    caption: <AvailabilityBadge availability={b.availability} />,
  }));
  const open = books.find((b) => b.id === openId);

  return (
    <>
      <BookShelf items={items} onSelect={(i) => setOpenId(i.id)} />
      {open && <BookDetailsModal bookId={open.id} title={open.title} onClose={() => setOpenId(null)} />}
    </>
  );
}