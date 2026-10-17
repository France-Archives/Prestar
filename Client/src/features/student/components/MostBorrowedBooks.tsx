import Card from "@/components/ui/Card";
import BookShelf, { type ShelfItem } from "@/features/books/components/BookShelf";
import { ROUTES } from "@/app/routeConfig";
import type { PopularBook } from "@/types";

export default function MostBorrowedBooks({ books }: { books: PopularBook[] }) {
  const items: ShelfItem[] = books.map((b) => ({
    id: b.bookId,
    title: b.title,
    coverUrl: null, // the statistics carry no cover image; a typographic cover is drawn from the title
    href: ROUTES.student.bookDetails(b.bookId),
    caption: <span className="badge badge-info">{b.loanCount} loans</span>,
  }));
  return (
    <Card title="Most borrowed" padded={false}>
      <div style={{ padding: "8px 12px 4px" }}>
        {items.length === 0 ? <p className="subtle" style={{ padding: 8 }}>No data yet.</p> : <BookShelf items={items} />}
      </div>
    </Card>
  );
}