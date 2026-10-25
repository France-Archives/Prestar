import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

/** Counts up once when visible, and animates later target updates from the current value. */
export function useCountUp<T extends Element = HTMLSpanElement>(target: number, duration = 1100) {
  const [value, setValue] = useState(0);
  const ref = useRef<T | null>(null);
  const started = useRef(false);
  const currentValue = useRef(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (reducedMotion || !el || typeof IntersectionObserver === "undefined") {
      started.current = true;
      currentValue.current = target;
      setValue(target);
      return;
    }

    let frame = 0;
    let observer: IntersectionObserver | null = null;
    const animate = () => {
      started.current = true;
      const from = currentValue.current;
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const next = progress === 1 ? target : from + (target - from) * (1 - (1 - progress) ** 3);
        currentValue.current = next;
        setValue(next);
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    if (started.current) {
      animate();
    } else {
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          observer?.disconnect();
          animate();
        }
      }, { threshold: 0.2 });
      observer.observe(el);
    }

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [duration, reducedMotion, target]);

  return { value, ref };
}
