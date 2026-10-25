import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import BookGrid from "@/features/books/components/BookGrid";
import { ROUTES } from "@/app/routeConfig";
import * as booksService from "@/services/booksService";
import type { BookSummary } from "@/types";
import { describeError } from "@/utils/errors";

export default function RecommendedBooks({ books }: { books: BookSummary[] | null }) {
  const [fallback, setFallback] = useState<BookSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (books !== null) {
      setFallback(null);
      setError(null);
      return;
    }
    let active = true;
    setError(null);
    void booksService.getRecommendedBooks().then((recommended) => {
      if (active) setFallback(recommended);
    }).catch((cause: unknown) => {
      if (active) setError(describeError(cause));
    });
    return () => {
      active = false;
    };
  }, [books, attempt]);

  const recommended = books ?? fallback;
  return (
    <>
      {books === null && recommended === null && !error ? (
        <div className="book-row" aria-label="Loading recommendations" role="status">
          {Array.from({ length: 4 }, (_, index) => <div className="book-skel skeleton" key={index} />)}
          <span className="sr-only">Loading recommendations…</span>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => setAttempt((value) => value + 1)} />
      ) : recommended?.length ? (
        <BookGrid books={recommended} />
      ) : (
        <EmptyState
          title="No books match your interests yet"
          action={<Link to={ROUTES.student.profile} className="link-btn">Edit interests</Link>}
        />
      )}
    </>
  );
}