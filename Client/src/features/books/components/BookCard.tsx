import { Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import type { BookSummary } from "@/types";
import AvailabilityBadge from "./AvailabilityBadge";
import BookCover from "./BookCover";

export default function BookCard({ book }: { book: BookSummary }) {
  return (
    <article className="card" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12 }}>
      <Link to={ROUTES.student.bookDetails(book.id)} aria-label={`View ${book.title}`}>
        <BookCover src={book.coverImageUrl} title={book.title} />
      </Link>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {book.category && <span className="eyebrow" style={{ margin: 0 }}>{book.category.name}</span>}
        <h3 style={{ fontSize: "1rem" }}>{book.title}</h3>
        <p className="subtle">{book.authors.map((a) => a.name).join(", ") || "Unknown author"}</p>
        <div style={{ marginTop: "auto", paddingTop: 6 }}>
          <AvailabilityBadge availability={book.availability} />
        </div>
      </div>
      <Link to={ROUTES.student.bookDetails(book.id)} className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>
        View details
      </Link>
    </article>
  );
}