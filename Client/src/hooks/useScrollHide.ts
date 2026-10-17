import { useState, useEffect, useRef } from "react";

/** Hide navbar on scroll-down, show on scroll-up. Returns scrolled (>threshold) and visible. */
export function useScrollHide(threshold = 60) {
  const [visible, setVisible] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    const handler = () => {
      const y = window.scrollY;
      setScrolled(y > threshold);
      setVisible(y < threshold || y < lastY.current);
      lastY.current = y;
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [threshold]);
  return { visible, scrolled };
}
