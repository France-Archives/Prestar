import { useEffect, useState } from "react";

// True while the media query matches. Used to tell desktop (icon rail) from mobile (drawer).
export function useMediaQuery(query: string): boolean {
  // Read synchronously on first render so the sidebar never flashes the wrong mode.
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}