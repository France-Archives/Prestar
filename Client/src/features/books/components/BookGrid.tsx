import EmptyState from "@/components/feedback/EmptyState";
import type { BookSummary } from "@/types";
import BookCard from "./BookCard";

export default function BookGrid({ books, emptyText = "No books match your search." }: { books: BookSummary[]; emptyText?: string }) {
  if (books.length === 0) return <EmptyState title={emptyText} text="Try different words or clear the filters." />;
  return (
    <div className="grid-auto" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
      {books.map((b) => (
        <BookCard key={b.id} book={b} />
      ))}
    </div>
  );
}