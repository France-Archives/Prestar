import { useLayoutEffect, useRef, useState } from "react";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Pagination from "@/components/data-display/Pagination";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useSearchTerm } from "@/hooks/useSearchTerm";
import * as booksService from "@/services/booksService";
import type { BookListParams } from "@/types";
import BookFilters, { type BookFilterValues } from "../components/BookFilters";
import BookGrid from "../components/BookGrid";

const ROWS_PER_PAGE = 2;
const SHELF_GAP = 16;
const SHELF_SIDE_PAD = 32;

function columnsForWidth(width: number): number {
  const columnWidth = width < 480 ? 124 : width > 1100 ? 156 : 140;
  return Math.max(1, Math.floor((width - SHELF_SIDE_PAD + SHELF_GAP) / (columnWidth + SHELF_GAP)));
}

export default function BookCatalogPage() {
  const catalogRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef(6);
  const [columns, setColumns] = useState(6);
  const [columnsReady, setColumnsReady] = useState(false);
  const pageSize = columns * ROWS_PER_PAGE;
  const pageSizeRef = useRef(pageSize);

  // The search text lives in the URL (?q=): typing in the navbar box OR the box below updates the same value.
  const [search, setSearch] = useSearchTerm();
  const searchRef = useRef(search);
  searchRef.current = search;
  const [filters, setFilters] = useState<Pick<BookFilterValues, "categoryId" | "availability">>({ categoryId: "", availability: "" });

  // A new search always starts at page 1 (derived, so no extra request with the old page number).
  const [pageState, setPageState] = useState({ page: 1, search });
  const page = pageState.search === search ? pageState.page : 1;
  const pageRef = useRef(page);
  pageRef.current = page;
  pageSizeRef.current = pageSize;
  const setPage = (p: number) => {
    pageRef.current = p;
    setPageState({ page: p, search });
  };

  useLayoutEffect(() => {
    const element = catalogRef.current;
    if (!element) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const updateColumns = (width: number) => {
      const nextColumns = columnsForWidth(width);
      if (nextColumns === columnsRef.current) return;

      const firstVisibleIndex = (pageRef.current - 1) * pageSizeRef.current;
      const nextPage = Math.floor(firstVisibleIndex / (nextColumns * ROWS_PER_PAGE)) + 1;
      columnsRef.current = nextColumns;
      pageSizeRef.current = nextColumns * ROWS_PER_PAGE;
      pageRef.current = nextPage;
      setColumns(nextColumns);
      setPageState((current) => (
        current.search === searchRef.current && current.page === nextPage
          ? current
          : { page: nextPage, search: searchRef.current }
      ));
    };

    updateColumns(element.clientWidth);
    setColumnsReady(true);
    const observer = new ResizeObserver(([entry]) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => updateColumns(entry.contentRect.width), 100);
    });
    observer.observe(element);

    return () => {
      if (timeout) clearTimeout(timeout);
      observer.disconnect();
    };
  }, []);

  const categories = useAsync(() => booksService.listCategories(), []);
  const books = useAsync(
    () =>
      booksService.listBooks({
        search: search.trim() || undefined,
        categoryId: filters.categoryId || undefined,
        availability: (filters.availability || undefined) as BookListParams["availability"],
        page,
        pageSize,
      }),
    [search, filters.categoryId, filters.availability, page, pageSize],
    columnsReady,
  );

  const change = (next: BookFilterValues) => {
    if (next.search !== search) setSearch(next.search); // "Clear filters" also clears the search
    setFilters({ categoryId: next.categoryId, availability: next.availability });
    setPage(1);
  };

  const meta = books.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / pageSize)) : 1;

  return (
    <div className="page">
      <PageHero eyebrow="Library" title="Book catalog" description="Search the collection. Request an available book or reserve one when every copy is out." leading={<BackButton fallback={ROUTES.student.dashboard} />} />
      <BookFilters values={{ search, ...filters }} categories={categories.data ?? []} onChange={change} />
      <div ref={catalogRef} style={{ marginTop: 14 }}>
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
              <div className="book-catalog__pager">
                <Pagination
                  page={meta.page}
                  totalPages={totalPages}
                  from={meta.total === 0 ? 0 : (meta.page - 1) * pageSize + 1}
                  to={Math.min(meta.total, meta.page * pageSize)}
                  total={meta.total}
                  onPrev={() => setPage(Math.max(1, page - 1))}
                  onNext={() => setPage(Math.min(totalPages, page + 1))}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}