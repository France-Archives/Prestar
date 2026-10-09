import { useState } from "react";

export function usePaged<T>(items: T[], size: number) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(page, pages); // clamp when filters shrink the list
  return { page: p, pages, setPage, slice: items.slice((p - 1) * size, p * size) };
}