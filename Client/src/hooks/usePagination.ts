import { useCallback, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@/utils/constants";

// Shared 1-based pagination state (page >= 1, 1 <= pageSize <= 100), matching the API contract.
export function usePagination(total: number, initialPageSize: number = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(Math.min(100, Math.max(1, initialPageSize)));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages); // clamp when filters shrink the list

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(Math.min(100, Math.max(1, Math.floor(size))));
    setPage(1);
  }, []);

  return {
    page: current,
    pageSize,
    totalPages,
    from: total === 0 ? 0 : (current - 1) * pageSize + 1,
    to: Math.min(total, current * pageSize),
    hasPrev: current > 1,
    hasNext: current < totalPages,
    setPage,
    setPageSize,
    prev: () => setPage(Math.max(1, current - 1)),
    next: () => setPage(Math.min(totalPages, current + 1)),
    reset: () => setPage(1),
  };
}