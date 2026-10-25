import { useState } from "react";
import { useParams } from "react-router-dom";
import Button from "@/components/common/Button";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import { ROUTES } from "@/app/routeConfig";
import AvailabilityBadge from "@/features/books/components/AvailabilityBadge";
import { useAsync } from "@/hooks/useAsync";
import * as booksService from "@/services/booksService";
import type { BookCopy } from "@/types";
import CopyForm from "../components/CopyForm";
import CopyStatusTable from "../components/CopyStatusTable";
import BookCopiesPanel from "../components/BookCopiesPanel";
import { USE_MOCKS } from "@/utils/constants";

export default function BookCopiesPage() {
  if (!USE_MOCKS) return <LiveBookCopiesPage />;
  const { bookId = "" } = useParams();
  const book = useAsync(() => booksService.getBook(bookId), [bookId]);
  const copies = useAsync(() => booksService.listBookCopies(bookId), [bookId]);
  const [dialog, setDialog] = useState<{ kind: "add" } | { kind: "edit"; copy: BookCopy } | null>(null);

  if ((book.loading || copies.loading) && !copies.data) return <div className="page"><LoadingState rows={4} /></div>;
  if (book.error || copies.error || !book.data) return <div className="page"><ErrorState message={book.error ?? copies.error ?? "Book not found."} onRetry={() => { void book.reload(); void copies.reload(); }} /></div>;

  const reload = () => {
    void book.reload();
    void copies.reload();
  };

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: "Books", to: ROUTES.staff.books }, { label: book.data.title }]} />
      <PageHero
        eyebrow="Catalog"
        title={`Copies of ${book.data.title}`}
        description="Each physical copy has its own barcode, status and condition."
        leading={<BackButton fallback={ROUTES.staff.dashboard} />}
        compact
        actions={<Button onClick={() => setDialog({ kind: "add" })}>Add copy</Button>}
      />
      <p style={{ marginBottom: 12 }}>
        <AvailabilityBadge availability={book.data.availability} />
      </p>
      <div className="card">
        <CopyStatusTable rows={copies.data ?? []} onEdit={(c) => setDialog({ kind: "edit", copy: c })} empty="This title has no copies yet." />
      </div>
      {dialog?.kind === "add" && <CopyForm bookId={bookId} bookTitle={book.data.title} onClose={() => setDialog(null)} onDone={reload} />}
      {dialog?.kind === "edit" && <CopyForm copy={dialog.copy} bookTitle={book.data.title} onClose={() => setDialog(null)} onDone={reload} />}
    </div>
  );
}

function LiveBookCopiesPage() {
  const { bookId = "" } = useParams();
  const book = useAsync(() => booksService.getBook(bookId), [bookId]);
  if (book.loading && !book.data) return <div className="page"><LoadingState rows={4} /></div>;
  if (book.error || !book.data) return <div className="page"><ErrorState message={book.error ?? "Book not found."} onRetry={() => void book.reload()} /></div>;
  return (
    <div className="page">
      <Breadcrumbs items={[{ label: "Books", to: ROUTES.staff.books }, { label: book.data.title }]} />
      <PageHero
        eyebrow="Catalog"
        title={`Copies of ${book.data.title}`}
        description="Review each physical copy and update its shelf location."
        leading={<BackButton fallback={ROUTES.staff.dashboard} />}
        compact
      />
      <BookCopiesPanel bookId={bookId} />
    </div>
  );
}