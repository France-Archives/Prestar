import Badge from "./Badge";
import Cover from "./Cover";
import type { Recommendation } from "../types";
import { availabilityText } from "../utils/lookup";
import "./RecommendedBooks.css";

type RecommendedBooksProps = {
  items: Recommendation[];
  onView: (title: string) => void;
  onEditInterests: () => void;
};

export default function RecommendedBooks({ items, onView, onEditInterests }: RecommendedBooksProps) {
  return (
    <div className="panel section">
      <div className="rec-head">
        <div>
          <h2>Recommended for You</h2>
          <p className="muted">Based on your interests and what you have borrowed.</p>
        </div>
        <button className="text-btn" onClick={onEditInterests}>Edit interests</button>
      </div>

      {items.length === 0 ? (
        <p className="muted">No recommendations right now. Edit your interests or check back when more books are available.</p>
      ) : (
        <div className="rec-grid">
          {items.map(({ book, availability, reason }) => (
            <article className="rec-card" key={book.book_id}>
              <div className="mini"><Cover book={book} /></div>
              <div className="rec-info">
                <h3>{book.title}</h3>
                <p className="muted">{book.author}</p>
                <span className="rec-reason">{reason}</span>
                <Badge status={availability.free > 0 ? "Available" : "Waiting"}>{availabilityText(availability)}</Badge>
                <button className="btn ghost sm" onClick={() => onView(book.title)}>View in Books</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}