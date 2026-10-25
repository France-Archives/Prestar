import { useEffect, useRef, useState } from "react";

/** Reports the first time an element enters the viewport. */
export function useInView<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [isInView, setIsInView] = useState(false);
  const entered = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !entered.current) {
        entered.current = true;
        setIsInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.08 });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, isInView };
}
