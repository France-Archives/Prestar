import { useState } from "react";

interface BookCoverProps {
  src: string | null;
  title: string;
  className?: string;
}

const FALLBACK = "/images/default-book-cover.png";

export default function BookCover({ src, title, className = "" }: BookCoverProps) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={!src || failed ? FALLBACK : src}
      alt={`Cover of ${title}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
      style={{ width: "100%", aspectRatio: "2 / 3", objectFit: "cover", borderRadius: "var(--radius-sm)", background: "var(--color-mist)" }}
    />
  );
}