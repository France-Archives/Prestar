import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Pagination from "@/components/data-display/Pagination";
import SearchInput from "@/components/forms/SearchInput";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import AvailabilityBadge from "@/features/books/components/AvailabilityBadge";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import * as booksService from "@/services/booksService";
import type { BookDetail } from "@/types";
import BookForm from "../components/BookForm";

const PAGE_SIZE = 10;
type Dialog = { kind: "form"; book: BookDetail | null } | { kind: "archive"; book: BookDetail } | null;

// Also used by the Admin book management page. Needs Admin or a Librarian with catalog permission.
export default function ManageBooksPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog>(null);
  const books = useAsync(() => booksService.listBooksForStaff({ search: search || undefined, page, pageSize: PAGE_SIZE }), [search, page]);
  const categories = useAsync(() => booksService.listCategories(), []);
  const authors = useAsync(() => booksService.listAuthors(), []);

  const meta = books.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  const columns: Column<BookDetail>[] = [
    { key: "title", header: "Title", render: (b) => <b>{b.title}</b> },
    { key: "authors", header: "Authors", render: (b) => b.authors.map((a) => a.name).join(", ") || "—" },
    { key: "category", header: "Category", render: (b) => b.category?.name ?? "—" },
    { key: "availability", header: "Copies", render: (b) => <AvailabilityBadge availability={b.availability} /> },
    { key: "isArchived", header: "State", render: (b) => (b.isArchived ? <span className="badge badge-neutral">Archived</span> : <span className="badge badge-ok">Active</span>) },
    {
      key: "actions",
      header: "",
      render: (b) => (
        <div className="row-actions">
          <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "form", book: b })}>
            Edit
          </Button>
          <Link to={ROUTES.staff.bookCopies(b.id)} className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>
            Copies
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "archive", book: b })}>
            {b.isArchived ? "Restore" : "Archive"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Catalog"
        title="Books"
        description="Add and edit titles. A title with active loans, pickups or reservations cannot be archived."
        actions={<Button onClick={() => setDialog({ kind: "form", book: null })}>Add book</Button>}
      />
      <div className="toolbar" style={{ marginTop: 0 }}>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search title, ISBN or author…" />
      </div>
      {books.loading ? (
        <LoadingState rows={4} />
      ) : books.error ? (
        <ErrorState message={books.error} onRetry={() => void books.reload()} />
      ) : (
        <div className="card">
          <DataTable columns={columns} rows={books.data?.data ?? []} rowKey={(b) => b.id} empty="No books match." pageSize={PAGE_SIZE} />
          {meta && (
            <Pagination
              page={meta.page}
              totalPages={totalPages}
              from={meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1}
              to={Math.min(meta.total, meta.page * meta.pageSize)}
              total={meta.total}
              onPrev={() => setPage(Math.max(1, page - 1))}
              onNext={() => setPage(Math.min(totalPages, page + 1))}
            />
          )}
        </div>
      )}
      {dialog?.kind === "form" && (
        <BookForm book={dialog.book} categories={categories.data ?? []} authors={authors.data ?? []} onClose={() => setDialog(null)} onDone={() => void books.reload()} />
      )}
      {dialog?.kind === "archive" && (
        <ConfirmDialog
          title={dialog.book.isArchived ? "Restore this book?" : "Archive this book?"}
          danger={!dialog.book.isArchived}
          confirmLabel={dialog.book.isArchived ? "Restore" : "Archive"}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await booksService.updateBook(dialog.book.id, { isArchived: !dialog.book.isArchived });
            toast.success(dialog.book.isArchived ? "Book restored." : "Book archived. History is kept.");
            await books.reload();
          }}
        >
          <p>{dialog.book.isArchived ? "The title will appear in the student catalog again." : "The title is hidden from students. Loans and history are kept."}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}