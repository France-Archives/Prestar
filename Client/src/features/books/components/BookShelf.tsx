import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

export interface ShelfItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Real cover image. When null, a typographic cover is drawn from the real title and author. */
  coverUrl: string | null;
  href: string;
  caption?: ReactNode;
}

interface BookShelfProps {
  items: ShelfItem[];
  /** When given, clicking a book calls this instead of following href. */
  onSelect?: (item: ShelfItem) => void;
}

const TONES = ["#1b4332", "#2d6a4f", "#335c67", "#7d2223", "#5b4a2e", "#264653", "#3b3a56", "#6b4226"];
const GAP = 16;

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

function Cover({ item }: { item: ShelfItem }) {
  const [failed, setFailed] = useState(false);
  if (item.coverUrl && !failed) {
    return <img src={item.coverUrl} alt={`Cover of ${item.title}`} loading="lazy" onError={() => setFailed(true)} />;
  }
  return (
    <div className="shelf-fallback" style={{ ["--tone" as string]: TONES[hash(item.id) % TONES.length] }} role="img" aria-label={`Cover of ${item.title}`}>
      <strong>{item.title}</strong>
      {item.subtitle && <span>{item.subtitle}</span>}
    </div>
  );
}

export default function BookShelf({ items, onSelect }: BookShelfProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || 960);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Covers stay readable: never narrower than 124px, and at least 2 per shelf.
  const cw = width < 480 ? 124 : width > 1100 ? 156 : 140;
  const perRow = Math.max(2, Math.floor((width - 24 + GAP) / (cw + GAP)));
  const rows: ShelfItem[][] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));

  return (
    <div ref={ref}>
      {rows.map((row, r) => (
        <div key={r} className="shelf" style={{ ["--cw" as string]: `${cw}px`, ["--gap" as string]: `${GAP}px`, ["--n" as string]: row.length }}>
          <div className="shelf-books">
            {row.map((item) => {
              const s = 0.93 + (hash(item.id) % 8) / 100; // slight width variation, same proportions
              const book = (
                <span className="shelf-book" style={{ ["--s" as string]: s }}>
                  <Cover item={item} />
                </span>
              );
              return (
                <div key={item.id} className="shelf-slot">
                  {onSelect ? (
                    <button type="button" className="shelf-link" aria-label={`View ${item.title}`} onClick={() => onSelect(item)}>
                      {book}
                    </button>
                  ) : (
                    <Link to={item.href} className="shelf-link" aria-label={`View ${item.title}`}>
                      {book}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
          <div className="shelf-plank" aria-hidden="true" />
          <div className="shelf-labels">
            {row.map((item) => (
              <div key={item.id} className="shelf-label">
                <h3>{item.title}</h3>
                {item.subtitle && <p>{item.subtitle}</p>}
                {item.caption}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}