import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import BookCard from "./BookCard";
import BookCover from "./BookCover";

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
  /** "shelf" stands the books on wooden planks. "row" is one horizontal strip, "grid" wraps responsively. */
  layout?: "grid" | "row" | "shelf";
}

const GAP = 16;
const SIDE_PAD = 32; // left + right padding inside a shelf

export default function BookShelf({ items, onSelect, selectedId = null, layout = "shelf" }: BookShelfProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);

  useEffect(() => {
    if (layout !== "shelf") return;
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || 960);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  if (layout !== "shelf") {
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

  // Covers stay readable: never narrower than 124px, with at least 1 per shelf.
  const cw = width < 480 ? 124 : width > 1100 ? 156 : 140;
  const perRow = Math.max(1, Math.floor((width - SIDE_PAD + GAP) / (cw + GAP)));
  const rows: ShelfItem[][] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));

  const cover = (item: ShelfItem) => {
    const inner = (
      <div className="book-card__3d">
        <div className="book-card__3d-face book-card__3d-front">
          <BookCover src={item.coverUrl} title={item.title} author={item.subtitle} />
        </div>
        <div className="book-card__3d-face book-card__3d-spine" aria-hidden="true" />
        <div className="book-card__3d-face book-card__3d-pages" aria-hidden="true" />
        <div className="book-card__3d-face book-card__3d-top" aria-hidden="true" />
        <div className="book-card__3d-face book-card__3d-back" aria-hidden="true" />
        <div className="book-card__3d-overlay">
          {item.rank !== undefined && <span className="book-card__rank" aria-hidden="true">{item.rank}</span>}
          <span className="book-card__hint" aria-hidden="true">View details</span>
        </div>
      </div>
    );
    return onSelect ? (
      <button type="button" className="book-card__cover" aria-label={`View ${item.title}`} aria-haspopup="dialog" aria-pressed={selectedId === item.id} onClick={() => onSelect(item)}>
        {inner}
      </button>
    ) : (
      <Link to={item.href} className="book-card__cover" aria-label={`View ${item.title}`}>
        {inner}
      </Link>
    );
  };

  return (
    <div ref={ref} className="bshelf-wrap">
      {rows.map((row, r) => (
        <div key={r} className="bshelf" style={{ "--cw": `${cw}px`, "--gap": `${GAP}px`, "--n": perRow } as CSSProperties}>
          <div className="bshelf__stage">
            <ul className="bshelf__books">
              {row.map((item) => (
                <li key={item.id} className={`bshelf__slot${selectedId === item.id ? " is-selected" : ""}`}>
                  {cover(item)}
                </li>
              ))}
            </ul>
            <div className="bshelf__plank" aria-hidden="true" />
            <div className="bshelf__front" aria-hidden="true" />
          </div>
          <ul className="bshelf__labels">
            {row.map((item) => (
              <li key={item.id} className="book-card__meta">
                <h3 title={item.title}>{item.title}</h3>
                {item.subtitle && <p>{item.subtitle}</p>}
                {item.caption}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}