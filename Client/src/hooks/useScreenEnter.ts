import { useEffect, useRef, useCallback } from "react";
import { useReducedMotion } from "motion/react";

export type EnterAnimFn = (
  el: HTMLElement,
  reduced: boolean
) => Promise<void> | void;

/**
 * Fires `onEnter` whenever the target element intersects at ≥threshold.
 * Replays each time — including when the user scrolls back.
 * Exit animations are NOT applied (so scrolling is never blocked).
 */
export function useScreenEnter(
  onEnter: EnterAnimFn,
  threshold = 0.55
) {
  const ref = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion() ?? false;

  const run = useCallback(() => {
    if (ref.current) onEnter(ref.current, reduced);
  }, [onEnter, reduced]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) run();
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [run, threshold]);

  return ref;
}
