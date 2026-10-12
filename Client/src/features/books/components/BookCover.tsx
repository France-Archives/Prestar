import { useState } from "react";

interface BookCoverProps {
  src: string | null;
  title: string;
  author?: string;
  className?: string;
}

// Palette tones only (forest, deep green, sage, gold, muted blue).
const TONES = ["#0b3d32", "#07352c", "#1f5a49", "#2f6f57", "#4d6b52", "#6e5a34", "#8c6430", "#335c67"];

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

/** One frame for every cover: same ratio, radius, spine and shadow. Real image when available, tidy placeholder otherwise. */
export default function BookCover({ src, title, author, className = "" }: BookCoverProps) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <div className={`book-cover ${className}`}>
        <img src={src} alt={`Cover of ${title}`} loading="lazy" onError={() => setFailed(true)} />
      </div>
    );
  }

  return (
    <div
      className={`book-cover book-cover--placeholder ${className}`}
      style={{ ["--tone" as string]: TONES[hash(title) % TONES.length] }}
      role="img"
      aria-label={`Cover of ${title}`}
    >
      <span className="book-cover__rule" aria-hidden="true" />
      <strong>{title}</strong>
      {author && <span>{author}</span>}
    </div>
  );
}