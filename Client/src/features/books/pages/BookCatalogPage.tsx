import { useState } from "react";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Pagination from "@/components/data-display/Pagination";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import { useSearchTerm } from "@/hooks/useSearchTerm";
import * as booksService from "@/services/booksService";
import type { BookListParams } from "@/types";
import BookFilters, { type BookFilterValues } from "../components/BookFilters";
import BookGrid from "../components/BookGrid";

const PAGE_SIZE = 12;

export default function BookCatalogPage() {
  // The search text lives in the URL (?q=): typing in the navbar box OR the box below updates the same value.
  const [search, setSearch] = useSearchTerm();
  const [filters, setFilters] = useState<Pick<BookFilterValues, "categoryId" | "availability">>({ categoryId: "", availability: "" });

  // A new search always starts at page 1 (derived, so no extra request with the old page number).
  const [pageState, setPageState] = useState({ page: 1, search });
  const page = pageState.search === search ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ page: p, search });

  const categories = useAsync(() => booksService.listCategories(), []);
  const books = useAsync(
    () =>
      booksService.listBooks({
        search: search.trim() || undefined,
        categoryId: filters.categoryId || undefined,
        availability: (filters.availability || undefined) as BookListParams["availability"],
        page,
        pageSize: PAGE_SIZE,
      }),
    [search, filters.categoryId, filters.availability, page],
  );

  const change = (next: BookFilterValues) => {
    if (next.search !== search) setSearch(next.search); // "Clear filters" also clears the search
    setFilters({ categoryId: next.categoryId, availability: next.availability });
    setPage(1);
  };

  const meta = books.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  return (
    <div className="page">
      <PageHeader eyebrow="Library" title="Book catalog" description="Search the collection. Request an available book or reserve one when every copy is out." />
      <BookFilters values={{ search, ...filters }} categories={categories.data ?? []} onChange={change} />
      <div style={{ marginTop: 14 }}>
        {books.loading ? (
          <LoadingState rows={3} />
        ) : books.error ? (
          <ErrorState message={books.error} onRetry={() => void books.reload()} />
        ) : (
          <>
            <p className="subtle" style={{ marginBottom: 10 }}>
              {meta?.total ?? 0} {meta?.total === 1 ? "book" : "books"}
            </p>
            <BookGrid books={books.data?.data ?? []} />
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
          </>
        )}
      </div>
    </div>
  );
}