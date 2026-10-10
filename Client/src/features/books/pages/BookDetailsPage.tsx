import { useParams } from "react-router-dom";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as booksService from "@/services/booksService";
import { BookDetailsContent } from "../components/BookDetailsModal";

// Full-page version of the book details (deep links, bookmarks). The catalog opens the same content in a modal.
export default function BookDetailsPage() {
  const { bookId = "" } = useParams();
  const { data: book, loading, error, reload } = useAsync(() => booksService.getBook(bookId), [bookId]);

  // Also treat "data from a different book" as loading, so a previous title never flashes.
  if (loading && (!book || book.id !== bookId)) return <div className="page"><LoadingState rows={4} /></div>;
  if (error || !book) return <div className="page"><ErrorState message={error ?? "Book not found."} onRetry={() => void reload()} /></div>;

  const authors = book.authors.map((a) => a.name).join(", ") || "Unknown author";

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: "Book catalog", to: ROUTES.student.books }, { label: book.title }]} />
      <PageHeader eyebrow={book.category?.name ?? "Book"} title={book.title} description={`by ${authors}`} />
      <BookDetailsContent book={book} reload={() => void reload()} large />
    </div>
  );
}