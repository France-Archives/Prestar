import { useCallback, useEffect, useState } from "react";
import Badge from "./Badge";
import BookAction from "./BookAction";
import Cover from "./Cover";
import { useAuthedLibrary } from "../context/LibraryContext";
import * as api from "../services/api";
import type { Book, BookActionType } from "../types";
import { availabilityText } from "../utils/lookup";

type BookModalProps = {
  book: Book;
  onClose: () => void;
  onAction: (book: Book, action: BookActionType) => void;
};

export default function BookModal({ book, onClose, onAction }: BookModalProps) {
  const { db, user } = useAuthedLibrary();
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  const state = api.bookActionState(user.user_id, book.book_id);
  const avail = api.bookAvailability(book.book_id);
  const category = db.categories.find((c) => c.category_id === book.category_id)?.category_name;

  return (
    <div className={`overlay ${closing ? "out" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={book.title}>
        <button className="modal-close" onClick={close} aria-label="Close">✕</button>
        <div className="modal-cover"><Cover book={book} large /></div>
        <div className="modal-body">
          <span className="eyebrow">{category}</span>
          <h2>{book.title}</h2>
          <p className="author">by {book.author}</p>
          <div className="modal-badges">
            <Badge status={avail.free > 0 ? "Available" : "Lost"}>{availabilityText(avail)}</Badge>
          </div>
          {book.description && <p className="desc">{book.description}</p>}
          <dl className="facts">
            <div><dt>ISBN</dt><dd>{book.isbn ?? "—"}</dd></div>
            <div><dt>Publisher</dt><dd>{book.publisher ?? "—"}</dd></div>
            <div><dt>Edition</dt><dd>{book.edition ?? "—"}</dd></div>
            <div><dt>Published</dt><dd>{book.year_published ?? "—"}</dd></div>
            <div><dt>Shelf</dt><dd>{book.shelf_location ?? "—"}</dd></div>
            <div><dt>Copies</dt><dd>{avail.free} free of {avail.circulating}</dd></div>
            <div><dt>Waiting</dt><dd>{avail.queueLength}</dd></div>
          </dl>
          <div className="modal-actions">
            <BookAction state={state} onClick={() => onAction(book, state.action)} />
          </div>
        </div>
      </div>
    </div>
  );
}