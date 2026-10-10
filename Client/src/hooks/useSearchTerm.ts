import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// One search term per page, kept in the URL as ?q=.
// The navbar search box writes it; the page reads it and filters its own data.
// Navigating to another page drops the query string, so every page starts with an empty search.
export const SEARCH_PARAM = "q";

export function useSearchTerm(): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const term = params.get(SEARCH_PARAM) ?? "";

  const setTerm = useCallback(
    (value: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev); // keep any other query params
          if (value) next.set(SEARCH_PARAM, value);
          else next.delete(SEARCH_PARAM);
          return next;
        },
        { replace: true }, // typing must not fill the browser history
      );
    },
    [setParams],
  );

  return [term, setTerm];
}

/** Client-side match for lists that are already loaded. An empty term matches everything. */
export function matchesSearch(term: string, ...fields: (string | number | null | undefined)[]): boolean {
  const t = term.trim().toLowerCase();
  return !t || fields.some((f) => f != null && String(f).toLowerCase().includes(t));
}