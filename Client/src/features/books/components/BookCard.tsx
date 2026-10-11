import { useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import type { BookSummary } from "@/types";
import AvailabilityBadge from "./AvailabilityBadge";
import BookCover from "./BookCover";
import BookDetailsModal from "./BookDetailsModal";

export default function BookCard({ book }: { book: BookSummary }) {
  const [open, setOpen] = useState(false);
  const href = ROUTES.student.bookDetails(book.id);

  // Plain left click opens the modal. Modified clicks (new tab / window) keep the normal link behaviour.
  const openModal = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setOpen(true);
  };

  return (
    <article className="card" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10 }}>
      <Link to={href} onClick={openModal} aria-label={`View ${book.title}`}>
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
      <Link to={href} onClick={openModal} className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>
        View details
      </Link>
      {open && <BookDetailsModal bookId={book.id} title={book.title} onClose={() => setOpen(false)} />}
    </article>
  );
}