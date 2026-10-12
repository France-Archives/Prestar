import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import BookCover from "./BookCover";

export interface BookCardProps {
  id: string;
  title: string;
  author?: string;
  coverUrl: string | null;
  href: string;
  caption?: ReactNode;
  rank?: number;
  selected?: boolean;
  /** When given, the card opens the details modal instead of following href. */
  onSelect?: () => void;
}

/** The one book card used by every collection: dashboard rows, catalog, search results. */
export default function BookCard({ title, author, coverUrl, href, caption, rank, selected = false, onSelect }: BookCardProps) {
  const inner = (
    <>
      <BookCover src={coverUrl} title={title} author={author} />
      {rank !== undefined && <span className="book-card__rank" aria-hidden="true">{rank}</span>}
      <span className="book-card__hint" aria-hidden="true">View details</span>
    </>
  );

  return (
    <article className={`book-card${selected ? " is-selected" : ""}`}>
      {onSelect ? (
        <button type="button" className="book-card__cover" aria-label={`View ${title}`} aria-haspopup="dialog" aria-pressed={selected} onClick={onSelect}>
          {inner}
        </button>
      ) : (
        <Link to={href} className="book-card__cover" aria-label={`View ${title}`}>
          {inner}
        </Link>
      )}
      <div className="book-card__meta">
        <h3 title={title}>{title}</h3>
        {author && <p>{author}</p>}
        {caption}
      </div>
    </article>
  );
}