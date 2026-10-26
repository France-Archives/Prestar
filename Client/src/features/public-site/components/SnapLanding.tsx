import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  type CSSProperties,
} from "react";
import { motion, useReducedMotion, useMotionValue, useTransform } from "motion/react";
import "../styles/landing.css";

interface SnapSection {
  id: string;
  label: string;
}

interface SnapLandingProps {
  sections: SnapSection[];
  children: ReactNode;
}

/** Returns true when both viewport width ≥1024 and height ≥650 */
function useSnapEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const check = () =>
      setEnabled(window.innerWidth >= 1024 && window.innerHeight >= 650);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);
  return enabled;
}

export default function SnapLanding({ sections, children }: SnapLandingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const snapEnabled = useSnapEnabled();
  const [activeIdx, setActiveIdx] = useState(0);

  // Scroll progress for the gold bar
  const scrollFraction = useMotionValue(0);
  const scaleX = useTransform(scrollFraction, [0, 1], [0, 1]);

  // Update scroll fraction from whichever scroller is active
  useEffect(() => {
    const el = snapEnabled ? containerRef.current : document.documentElement;
    if (!el) return;
    const update = () => {
      const top = el.scrollTop;
      const max = el.scrollHeight - el.clientHeight;
      scrollFraction.set(max > 0 ? top / max : 0);
    };
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
  }, [snapEnabled, scrollFraction]);

  // Track which section is in view via IntersectionObserver
  useEffect(() => {
    const root = snapEnabled ? containerRef.current : null;
    const sectionEls = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[];
    if (!sectionEls.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
            const idx = sectionEls.indexOf(entry.target as HTMLElement);
            if (idx !== -1) setActiveIdx(idx);
          }
        }
      },
      { root, threshold: 0.4 }
    );
    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections, snapEnabled]);

  const scrollTo = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      const container = containerRef.current;
      if (snapEnabled && container) {
        container.scrollTo({
          top: el.offsetTop,
          behavior: reducedMotion ? "instant" : "smooth",
        });
      } else {
        el.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" });
      }
    },
    [snapEnabled, reducedMotion]
  );

  return (
    <>
      {/* Gold scroll progress bar — driven by snap container or window */}
      <motion.div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: "var(--color-amber)",
          scaleX,
          transformOrigin: "left",
          zIndex: 200,
        }}
      />

      <div
        ref={containerRef}
        className={`snap-landing-root${snapEnabled ? " snap-landing-root--active" : ""}`}
        aria-label="Landing page"
      >
        {children}

        {/* Vertical dot navigation — desktop snap mode only */}
        {snapEnabled && (
          <nav
            className="snap-dot-nav"
            aria-label="Page sections"
            style={{ "--dot-count": sections.length } as CSSProperties}
          >
            {sections.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`snap-dot${i === activeIdx ? " snap-dot--active" : ""}`}
                onClick={() => scrollTo(s.id)}
                aria-label={`Go to ${s.label}`}
                aria-current={i === activeIdx ? "true" : undefined}
                title={s.label}
              >
                <span className="snap-dot__tooltip" aria-hidden="true">{s.label}</span>
              </button>
            ))}
          </nav>
        )}
      </div>
    </>
  );
}
