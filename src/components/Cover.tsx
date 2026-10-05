import type { Book } from "../types";

type CoverProps = { book: Book; large?: boolean };

// PLACEHOLDER COVER: a coloured card with the title and author.
// If the book has a cover_image it is shown instead. The real cover design can replace this later.
export default function Cover({ book, large }: CoverProps) {
  if (book.cover_image) {
    return (
      <img
        src={book.cover_image}
        alt={`Cover of ${book.title}`}
        style={{ width: "100%", aspectRatio: "2 / 3", objectFit: "cover", borderRadius: 8, display: "block" }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`Cover of ${book.title}`}
      style={{
        width: "100%",
        aspectRatio: "2 / 3",
        background: book.color,
        color: "#fff",
        borderRadius: 8,
        padding: large ? 20 : 8,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
        boxShadow: "0 6px 16px rgba(0,0,0,.18)",
      }}
    >
      <strong
        style={{
          fontFamily: "var(--serif, Georgia, serif)",
          fontSize: large ? 22 : 11,
          lineHeight: 1.2,
          overflowWrap: "anywhere",
        }}
      >
        {book.title}
      </strong>
      <span style={{ fontSize: large ? 13 : 9, opacity: 0.85 }}>{book.author}</span>
    </div>
  );
}