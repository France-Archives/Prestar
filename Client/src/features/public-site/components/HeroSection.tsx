import { type CSSProperties, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ChevronDown, Clock, ShieldCheck } from "lucide-react";
import { motion, useMotionValue, useTransform, useReducedMotion } from "motion/react";
import { ROUTES } from "@/app/routeConfig";
import { useCountUp } from "@/hooks/useCountUp";
import { useScreenEnter } from "@/hooks/useScreenEnter";
import { staggerIn, fadeIn, animTo } from "@/lib/motion";
import "../styles/landing.css";

const STATS = [
  { label: "Active catalog titles", value: 200,  suffix: "+" },
  { label: "Verified physical copies", value: 1000, suffix: "" },
  { label: "Automated hold window", value: 24,   suffix: "h" },
  { label: "Counter checkout pickup", value: 1,    suffix: " min" },
];

const HERO_BOOKS = [
  { id: "b1", title: "The Design of Everyday Things", callNo: "NK 1510", tone: "#1a5c48", posClass: "hero-book-pos-1", bobDelay: 0,   bobDuration: 4.8 },
  { id: "b2", title: "Clean Architecture",            callNo: "QA 76.76", tone: "#0b3d32", posClass: "hero-book-pos-2", bobDelay: 0.6, bobDuration: 5.2 },
  { id: "b3", title: "Structure and Interpretation",  callNo: "QA 76.6",  tone: "#335c67", posClass: "hero-book-pos-3", bobDelay: 1.2, bobDuration: 4.4 },
  { id: "b4", title: "Design Patterns",               callNo: "QA 76.73", tone: "#9e2a2b", posClass: "hero-book-pos-4", bobDelay: 1.8, bobDuration: 5.6 },
  { id: "b5", title: "Introduction to Algorithms",    callNo: "QA 76.9",  tone: "#8c6430", posClass: "hero-book-pos-5", bobDelay: 2.2, bobDuration: 4.6 },
];

const CHIPS = [
  { text: "Live shelf availability", icon: CheckCircle2, posClass: "hero-chip-pos-1", bobDelay: 0.3, bobDuration: 4.2 },
  { text: "Same-day counter pickup", icon: Clock,      posClass: "hero-chip-pos-2", bobDelay: 1.0, bobDuration: 4.9 },
  { text: "Automated FIFO waitlist", icon: ShieldCheck, posClass: "hero-chip-pos-3", bobDelay: 1.6, bobDuration: 5.4 },
];

function StatCard({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  const { value: count, ref } = useCountUp<HTMLDivElement>(value, 1600);
  return (
    <div ref={ref} className="hero-stat-card">
      <div className="hero-stat-num">
        {count.toLocaleString()}
        <span className="hero-stat-suffix">{suffix}</span>
      </div>
      <div className="hero-stat-label">{label}</div>
    </div>
  );
}

export default function HeroSection() {
  const reducedMotion = useReducedMotion() ?? false;
  const [isDesktop, setIsDesktop] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Cursor parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-12, 12]);
  const rotateX = useTransform(mouseY, [-0.5, 0.5], [10, -10]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reducedMotion || !isDesktop) return;
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
      mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [reducedMotion, isDesktop, mouseX, mouseY]
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  const scrollToNext = () => {
    document.getElementById("snap-books")?.scrollIntoView({ behavior: "smooth" });
  };

  // Screen-enter animation — replays each visit
  const sectionRef = useScreenEnter(
    useCallback(async (el: HTMLElement, reduced: boolean) => {
      // Query elements inside this section
      const lines  = el.querySelectorAll<HTMLElement>(".hero-headline__line");
      const svg    = el.querySelector<SVGPathElement>(".hero-headline__underline path");
      const books  = el.querySelectorAll<HTMLElement>(".book3d-wrapper");
      const chips  = el.querySelectorAll<HTMLElement>(".glass-chip");
      const stats  = el.querySelector<HTMLElement>(".hero-stats-wrap");

      if (reduced) {
        // Reduced motion: simple fades only
        [lines, books, chips].forEach(group => {
          Array.from(group).forEach((e, i) => {
            (e as HTMLElement).style.opacity = "0";
            (e as HTMLElement).style.transform = "none";
            fadeIn(e, i * 0.06);
          });
        });
        if (stats) { stats.style.opacity = "0"; fadeIn(stats, 0.3); }
        setStatsVisible(true);
        return;
      }

      // --- Full animation sequence ---

      // 1. Reset everything hidden
      Array.from(lines).forEach(l => { l.style.opacity = "0"; l.style.transform = "translateY(28px)"; });
      if (svg) { svg.style.strokeDasharray = "260"; svg.style.strokeDashoffset = "260"; svg.style.transition = "none"; }
      Array.from(books).forEach(b => { b.style.opacity = "0"; b.style.transform = "translateY(50px) scale(0.88)"; });
      Array.from(chips).forEach(c => { c.style.opacity = "0"; c.style.transform = "scale(0.7)"; });
      if (stats) { stats.style.opacity = "0"; stats.style.transform = "translateY(18px)"; }
      setStatsVisible(false);

      // 2. Headline lines slide up, staggered
      await Promise.all(staggerIn(Array.from(lines), "translateY(28px)", { stagger: 0.1, duration: 0.6, baseDelay: 0.05 }));

      // 3. Gold underline draws
      if (svg) {
        await new Promise<void>(resolve => {
          requestAnimationFrame(() => {
            svg.style.transition = "stroke-dashoffset 0.55s cubic-bezier(0.16,1,0.3,1)";
            svg.style.strokeDashoffset = "0";
            setTimeout(resolve, 580);
          });
        });
      }

      // 4. Books rise one by one
      await Promise.all(
        staggerIn(Array.from(books), "translateY(50px) scale(0.88)", {
          stagger: 0.1, duration: 0.6, baseDelay: 0, bounce: true,
        })
      );

      // 5. Chips pop in
      await Promise.all(
        staggerIn(Array.from(chips), "scale(0.7)", { stagger: 0.09, duration: 0.45 })
      );

      // 6. Stats fade up, then trigger count-up
      if (stats) {
        await animTo(stats, { opacity: 1, transform: "none" }, { duration: 0.5 });
        setStatsVisible(true);
      }
    }, []),
    0.55
  );

  return (
    <section
      className="hero-wrap land-grain"
      aria-label="Hero"
      ref={el => { (sectionRef as React.MutableRefObject<HTMLElement | null>).current = el; }}
    >
      <div className="land-container">
        <div className="hero-grid">
          {/* Left: Headlines & CTAs */}
          <div className="hero-content">
            <motion.div
              className="hero-badge"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="hero-badge__dot" aria-hidden="true" />
              <span>University Library Reservation System</span>
            </motion.div>

            <h1 className="hero-headline" style={{ willChange: "opacity, transform" }}>
              <span className="hero-headline__line" style={{ opacity: 0, transform: "translateY(28px)" }}>Find it.</span>
              <span className="hero-headline__line" style={{ opacity: 0, transform: "translateY(28px)" }}>Request it.</span>
              <span className="hero-headline__line hero-headline__accent-wrap" style={{ opacity: 0, transform: "translateY(28px)" }}>
                <em>Pick it up.</em>
                <svg
                  className="hero-headline__underline"
                  viewBox="0 0 240 10"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M3 7C70 2 170 2 237 7"
                    stroke="#b98a4a"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    style={{ strokeDasharray: 260, strokeDashoffset: 260 }}
                  />
                </svg>
              </span>
            </h1>

            <motion.p
              className="hero-lead"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              The unified library reservation portal for students and faculty.
              Check live catalog holdings, reserve high-demand textbooks, and enjoy
              streamlined, same-day in-person pickups.
            </motion.p>

            <motion.div
              className="hero-actions"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link to={ROUTES.signup} className="hero-btn-primary" aria-label="Create a student account">
                <span>Create a student account</span>
                <ArrowRight size={18} className="hero-btn-primary__arrow" aria-hidden="true" />
              </Link>
              <Link to={ROUTES.login} className="hero-btn-secondary" aria-label="Log in">Log in</Link>
            </motion.div>
          </div>

          {/* Right: 3D Books Cluster */}
          <div
            className="hero-visual"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            aria-hidden="true"
          >
            <div className="hero-blob hero-blob--1" />
            <div className="hero-blob hero-blob--2" />

            <motion.div
              className="hero-books-stage"
              style={!reducedMotion && isDesktop ? { rotateX, rotateY } : undefined}
            >
              {HERO_BOOKS.map((b) => (
                <div
                  key={b.id}
                  className={`book3d-wrapper ${b.posClass}`}
                  style={{ "--book-tone": b.tone, opacity: 0, transform: "translateY(50px) scale(0.88)" } as CSSProperties}
                >
                  <motion.div
                    className="book3d"
                    animate={!reducedMotion ? { y: [0, -8, 0] } : undefined}
                    transition={{ duration: b.bobDuration, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: b.bobDelay }}
                  >
                    <div className="book3d__face book3d__front">
                      <div className="book3d__front-rule" />
                      <div className="book3d__front-title">{b.title}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", fontSize: "0.5625rem", letterSpacing: "0.08em", opacity: 0.85 }}>
                        <span>{b.callNo}</span>
                        <span className="book3d__front-logo">PRESTAR</span>
                      </div>
                    </div>
                    <div className="book3d__face book3d__back" />
                    <div className="book3d__spine">
                      <span className="book3d__spine-text">{b.title}</span>
                      <span style={{ fontSize: "0.5rem", color: "#b98a4a", marginTop: "auto", fontWeight: 700 }}>{b.callNo}</span>
                    </div>
                    <div className="book3d__pages" />
                  </motion.div>
                </div>
              ))}

              {CHIPS.map((chip) => {
                const Icon = chip.icon;
                return (
                  <motion.div
                    key={chip.text}
                    className={`glass-chip ${chip.posClass}`}
                    style={{ opacity: 0, transform: "scale(0.7)" }}
                    animate={!reducedMotion ? { y: [0, -6, 0] } : undefined}
                    transition={{ duration: chip.bobDuration, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: chip.bobDelay }}
                  >
                    <span className="glass-chip__icon"><Icon size={14} /></span>
                    <span>{chip.text}</span>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="hero-stats-wrap" style={{ opacity: 0, transform: "translateY(18px)" }}>
          <div className="hero-stats">
            {STATS.map((s) =>
              statsVisible
                ? <StatCard key={s.label} label={s.label} value={s.value} suffix={s.suffix} />
                : <div key={s.label} className="hero-stat-card">
                    <div className="hero-stat-num">—<span className="hero-stat-suffix">{s.suffix}</span></div>
                    <div className="hero-stat-label">{s.label}</div>
                  </div>
            )}
          </div>
        </div>

        {/* Scroll cue */}
        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <button type="button" className="hero-scroll-cue" onClick={scrollToNext} aria-label="Scroll to browse books">
            <span>Browse the collection</span>
            <ChevronDown size={18} className="hero-scroll-cue__chevron" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}