import Badge from "./Badge";
import BookAction from "./BookAction";
import Cover from "./Cover";
import { useAuthedLibrary } from "../context/LibraryContext";
import * as api from "../services/api";
import type { Book, BookActionType } from "../types";
import { availabilityText } from "../utils/lookup";

type BookCardProps = {
  book: Book;
  onOpen: (book: Book) => void;
  onAction: (book: Book, action: BookActionType) => void;
};

export default function BookCard({ book, onOpen, onAction }: BookCardProps) {
  const { db, user } = useAuthedLibrary();
  const state = api.bookActionState(user.user_id, book.book_id);
  const avail = api.bookAvailability(book.book_id);
  const category = db.categories.find((c) => c.category_id === book.category_id)?.category_name;

  return (
    <article className="book-card">
      <div className="book-cover-wrap">
        <button className="cover-btn" onClick={() => onOpen(book)} aria-label={`View ${book.title}`}><Cover book={book} /></button>
      </div>
      <div className="shelf" />
      <div className="book-meta">
        <span className="eyebrow">{category}</span>
        <h3>{book.title}</h3>
        <p>{book.author}</p>
        <Badge status={avail.free > 0 ? "Available" : "Lost"}>{availabilityText(avail)}</Badge>
        <div className="card-actions">
          <BookAction state={state} onClick={() => onAction(book, state.action)} />
          <button className="btn ghost" onClick={() => onOpen(book)}>View Details</button>
        </div>
      </div>
    </article>
  );
}