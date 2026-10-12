import type { ReactNode } from "react";
import BookCard from "./BookCard";

export interface ShelfItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Real cover image. When null, BookCover draws a consistent placeholder. */
  coverUrl: string | null;
  href: string;
  caption?: ReactNode;
  rank?: number;
}

interface BookShelfProps {
  items: ShelfItem[];
  /** When given, clicking a book calls this instead of following href. */
  onSelect?: (item: ShelfItem) => void;
  selectedId?: string | null;
  /** "row" is a single horizontal strip, "grid" wraps responsively. */
  layout?: "grid" | "row";
}

export default function BookShelf({ items, onSelect, selectedId = null, layout = "grid" }: BookShelfProps) {
  return (
    <ul className={`book-list ${layout === "row" ? "book-row" : "book-grid"}`}>
      {items.map((item) => (
        <li key={item.id}>
          <BookCard
            id={item.id}
            title={item.title}
            author={item.subtitle}
            coverUrl={item.coverUrl}
            href={item.href}
            caption={item.caption}
            rank={item.rank}
            selected={selectedId === item.id}
            onSelect={onSelect ? () => onSelect(item) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}