import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Pagination from "@/components/data-display/Pagination";
import SearchInput from "@/components/forms/SearchInput";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import AvailabilityBadge from "@/features/books/components/AvailabilityBadge";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import * as booksService from "@/services/booksService";
import type { BookDetail } from "@/types";
import { USE_MOCKS } from "@/utils/constants";
import { formatPeso } from "@/utils/formatCurrency";
import { can } from "@/utils/permissions";
import BookForm from "../components/BookForm";

const PAGE_SIZE = 10;
type Dialog = { kind: "form"; book: BookDetail | null } | { kind: "archive"; book: BookDetail } | null;

export default function ManageBooksPage() {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = can(user, "CATALOG_MANAGE");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [recentlyArchived, setRecentlyArchived] = useState<BookDetail[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const books = useAsync(
    () => booksService.listBooksForStaff({
      search: debouncedSearch || undefined,
      categoryId: categoryId || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, categoryId, page],
  );
  const categories = useAsync(() => booksService.listCategories(), []);
  const authors = useAsync(() => booksService.listAuthors(), []);
  const meta = books.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;
  const loadedBooks = books.data?.data ?? [];
  const localArchived = recentlyArchived.filter((book) => {
    if (loadedBooks.some((loaded) => loaded.id === book.id)) return false;
    if (categoryId && book.category?.id !== categoryId) return false;
    const query = debouncedSearch.toLocaleLowerCase();
    return !query || [book.title, book.isbn ?? "", book.publisher ?? "", ...book.authors.map((author) => author.name)]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query);
  });
  const visibleBooks = [...localArchived, ...loadedBooks];

  const openForm = (book: BookDetail | null) => setDialog({ kind: "form", book });
  const renderActions = (book: BookDetail) => (
    <div className="row-actions">
      {canManage && <Button variant="ghost" size="sm" onClick={() => openForm(book)}>Edit</Button>}
      {USE_MOCKS ? (
        <Link to={ROUTES.staff.bookCopies(book.id)} className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>
          Copies
        </Link>
      ) : (
        <Button variant="ghost" size="sm" disabled title="Not available yet">Copies</Button>
      )}
      {canManage && (
        <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "archive", book })}>
          {book.isArchived ? "Restore" : "Archive"}
        </Button>
      )}
    </div>
  );

  const columns: Column<BookDetail>[] = [
    {
      key: "cover",
      header: "Cover",
      render: (book) => book.coverImageUrl
        ? <img className="book-list-cover" src={book.coverImageUrl} alt="" loading="lazy" />
        : <span className="book-list-cover book-list-cover--empty" aria-label="No cover">—</span>,
    },
    {
      key: "title",
      header: "Title",
      render: (book) => <><b>{book.title}</b>{book.price && <small className="book-list-price">{formatPeso(Number(book.price))}</small>}</>,
    },
    { key: "authors", header: "Author", render: (book) => book.authors.map((author) => author.name).join(", ") || "—" },
    { key: "isbn", header: "ISBN", render: (book) => book.isbn || "—" },
    { key: "category", header: "Category", render: (book) => book.category?.name ?? "—" },
    { key: "availability", header: "Copies", render: (book) => (
      <div className="book-copy-status">
        <strong>{book.availability.availableCopies} / {book.availability.totalUsableCopies}</strong>
        <AvailabilityBadge availability={book.availability} />
      </div>
    ) },
    { key: "isArchived", header: "Status", render: (book) => book.isArchived
      ? <span className="badge badge-neutral">Archived</span>
      : <span className="badge badge-ok">Active</span> },
    { key: "actions", header: "", render: renderActions },
  ];

  return (
    <div className="page manage-books-page">
      <PageHero
        eyebrow="Catalog"
        title="Books"
        description="Search and browse the catalog. Titles with active loans, requests, or reservations cannot be archived."
        leading={<BackButton fallback={ROUTES.staff.dashboard} />}
        compact
        actions={canManage ? <Button onClick={() => openForm(null)}>Add book</Button> : undefined}
      />
      <div className="toolbar manage-books-toolbar" style={{ marginTop: 0 }}>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value.slice(0, 100));
          }}
          placeholder="Search title, ISBN, publisher, or author…"
        />
        <label className="manage-books-category">
          <span className="sr-only">Filter by category</span>
          <select
            className="select"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {(categories.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
      </div>
      <p className="manage-books-note">
        The API does not support a status filter, and the current list endpoint returns active titles only. Existing archived titles cannot be fetched after a page reload; titles archived during this session remain available to restore. {canManage ? "Copies management is not available yet." : "You have read-only catalog access."}
      </p>
      {categories.error && <p className="subtle" role="status">Category filtering is unavailable: {categories.error}</p>}

      {books.loading ? (
        <LoadingState rows={4} />
      ) : books.error ? (
        <ErrorState message={books.error} onRetry={() => void books.reload()} />
      ) : (
        <div className="manage-books-results">
          <div className={`card manage-books-table${visibleBooks.length > 0 ? " has-rows" : ""}`}>
            <DataTable
              key={page}
              columns={columns}
              rows={visibleBooks}
              rowKey={(book) => book.id}
              rowClassName={(book) => book.isArchived ? "book-row-archived" : undefined}
              empty="No books match."
              pageSize={PAGE_SIZE}
            />
          </div>
          {visibleBooks.length > 0 && (
            <div className="manage-books-mobile" aria-label="Books">
              {visibleBooks.map((book) => (
                <article className={`card manage-book-mobile-card${book.isArchived ? " is-archived" : ""}`} key={book.id}>
                  {book.coverImageUrl
                    ? <img className="manage-book-mobile-cover" src={book.coverImageUrl} alt="" loading="lazy" />
                    : <span className="manage-book-mobile-cover manage-book-mobile-cover--empty">No cover</span>}
                  <div className="manage-book-mobile-content">
                    <div className="manage-book-mobile-head">
                      <h2>{book.title}</h2>
                      {book.isArchived
                        ? <span className="badge badge-neutral">Archived</span>
                        : <span className="badge badge-ok">Active</span>}
                    </div>
                    <p>{book.authors.map((author) => author.name).join(", ") || "—"}</p>
                    <dl>
                      <div><dt>ISBN</dt><dd>{book.isbn || "—"}</dd></div>
                      <div><dt>Category</dt><dd>{book.category?.name ?? "—"}</dd></div>
                      <div><dt>Copies</dt><dd>{book.availability.availableCopies} / {book.availability.totalUsableCopies}</dd></div>
                    </dl>
                    {book.price && <p className="book-list-price">{formatPeso(Number(book.price))}</p>}
                    {renderActions(book)}
                  </div>
                </article>
              ))}
            </div>
          )}
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
      {!canManage && <p className="manage-books-readonly">Catalog management actions are only available to staff with catalog access.</p>}
      {dialog?.kind === "form" && (
        <BookForm
          book={dialog.book}
          categories={categories.data ?? []}
          authors={authors.data ?? []}
          authorsLoading={authors.loading}
          authorsError={authors.error}
          onRetryAuthors={() => void authors.reload()}
          onClose={() => setDialog(null)}
          onDone={() => void books.reload()}
        />
      )}
      {dialog?.kind === "archive" && (
        <ConfirmDialog
          title={`${dialog.book.isArchived ? "Restore" : "Archive"} ${dialog.book.title}?`}
          message={dialog.book.isArchived
            ? `${dialog.book.title} will appear in the student catalog again.`
            : `${dialog.book.title} will be hidden from students; loans and history will be kept.`}
          details={[{ label: "Book", value: dialog.book.title }, { label: "Action", value: dialog.book.isArchived ? "Restore" : "Archive" }]}
          variant={dialog.book.isArchived ? "normal" : "destructive"}
          confirmLabel={dialog.book.isArchived ? "Restore book" : "Archive book"}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const updated = await booksService.updateBook(dialog.book.id, { isArchived: !dialog.book.isArchived });
            setRecentlyArchived((current) => updated.isArchived
              ? [...current.filter((book) => book.id !== updated.id), updated]
              : current.filter((book) => book.id !== updated.id));
            toast.success(dialog.book.isArchived ? "Book restored." : "Book archived. History is kept.");
            await books.reload();
          }}
        />
      )}
    </div>
  );
}
