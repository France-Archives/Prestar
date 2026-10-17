import React, { useCallback, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion, useMotionValue, useReducedMotion } from "motion/react";
import { ROUTES } from "@/app/routeConfig";
import Logo from "@/components/common/Logo";
import { useScreenEnter } from "@/hooks/useScreenEnter";
import { animTo, staggerIn, fadeIn } from "@/lib/motion";
import "../styles/landing.css";

// Headline split into words for word-by-word reveal
const CTA_WORDS = ["Ready", "to", "borrow?"];

// Floating deco books in CTA — CSS 3D only, pointer-events none
const DECO_BOOKS = [
  { tone: "#1a5c48", cls: "cta-deco-float cta-deco-float--1", bobDur: 6.2 },
  { tone: "#0b3d32", cls: "cta-deco-float cta-deco-float--2", bobDur: 7.8 },
  { tone: "#335c67", cls: "cta-deco-float cta-deco-float--3", bobDur: 5.4 },
  { tone: "#8c6430", cls: "cta-deco-float cta-deco-float--4", bobDur: 8.1 },
] as const;

export default function CTABanner() {
  const reducedMotion = useReducedMotion() ?? false;
  const [btnPulse, setBtnPulse] = useState(false);

  // Magnetic button
  const btnX = useMotionValue(0);
  const btnY = useMotionValue(0);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (reducedMotion) return;
      const rect = e.currentTarget.getBoundingClientRect();
      btnX.set((e.clientX - rect.left - rect.width / 2) * 0.25);
      btnY.set((e.clientY - rect.top - rect.height / 2) * 0.25);
    },
    [btnX, btnY, reducedMotion]
  );

  const handleMouseLeave = useCallback(() => { btnX.set(0); btnY.set(0); }, [btnX, btnY]);

  const sectionRef = useScreenEnter(
    useCallback(async (el: HTMLElement, reduced: boolean) => {
      const words   = el.querySelectorAll<HTMLElement>(".cta-word");
      const lead    = el.querySelector<HTMLElement>(".cta-banner__lead");
      const actions = el.querySelector<HTMLElement>(".cta-banner__actions");
      const books   = el.querySelectorAll<HTMLElement>(".cta-deco-float");

      // Reset
      Array.from(words).forEach(w => { w.style.opacity = "0"; w.style.transform = "translateY(20px)"; });
      if (lead)    { lead.style.opacity    = "0"; lead.style.transform    = "translateY(14px)"; }
      if (actions) { actions.style.opacity = "0"; actions.style.transform = "translateY(14px)"; }
      Array.from(books).forEach(b => { b.style.opacity = "0"; b.style.transform += " scale(0.8)"; });
      setBtnPulse(false);

      if (reduced) {
        Array.from(words).forEach((w, i) => fadeIn(w, i * 0.06));
        if (lead)    fadeIn(lead,    0.2);
        if (actions) fadeIn(actions, 0.35);
        Array.from(books).forEach((b, i) => fadeIn(b, i * 0.08));
        setTimeout(() => setBtnPulse(true), 600);
        return;
      }

      // Words reveal one by one
      await Promise.all(
        staggerIn(Array.from(words), "translateY(20px)", { stagger: 0.1, duration: 0.5, baseDelay: 0.05 })
      );

      // Lead text
      if (lead) await animTo(lead, { opacity: 1, transform: "none" }, { duration: 0.5, delay: 0.05 });

      // Deco books drift in (parallel, no await)
      staggerIn(Array.from(books), "scale(0.8)", { stagger: 0.15, duration: 0.7, baseDelay: 0 });

      // Actions
      if (actions) await animTo(actions, { opacity: 1, transform: "none" }, { duration: 0.5 });

      // Trigger button pulse after actions appear
      setTimeout(() => setBtnPulse(true), 300);
    }, []),
    0.5
  );

  return (
    <div
      className="cta-screen-wrap land-grain"
      ref={el => { (sectionRef as React.MutableRefObject<HTMLElement | null>).current = el; }}
    >
      {/* ── CTA Banner ── */}
      <div className="cta-banner-inner">
        {/* Floating deco books */}
        {DECO_BOOKS.map((b) => (
          <div
            key={b.cls}
            className={b.cls}
            style={{ "--book-tone": b.tone, "--bob-dur": `${b.bobDur}s`, opacity: 0 } as CSSProperties}
            aria-hidden="true"
          >
            <div className="book3d">
              <div className="book3d__face book3d__front">
                <div className="book3d__front-rule" />
                <div className="book3d__front-title">PRESTAR</div>
                <div className="book3d__front-logo">LIBRARY</div>
              </div>
              <div className="book3d__face book3d__back" />
              <div className="book3d__spine" />
              <div className="book3d__pages" />
            </div>
          </div>
        ))}

        <div className="cta-banner__content">
          <span className="land-eyebrow land-eyebrow--light">Start today</span>

          {/* Word-by-word headline */}
          <h2 className="cta-banner__headline" aria-label="Ready to borrow?">
            {CTA_WORDS.map((word, i) => (
              <span
                key={i}
                className="cta-word"
                style={{ opacity: 0, transform: "translateY(20px)", display: "inline-block", marginRight: "0.3em" }}
              >
                {word === "borrow?" ? <em>{word}</em> : word}
              </span>
            ))}
          </h2>

          <p className="cta-banner__lead" style={{ opacity: 0, transform: "translateY(14px)" }}>
            Join thousands of students experiencing seamless, queue-free book borrowing.
            Create your free student account in under two minutes.
          </p>

          <div className="cta-banner__actions" style={{ opacity: 0, transform: "translateY(14px)" }}>
            <motion.div
              style={!reducedMotion ? { x: btnX, y: btnY } : undefined}
              whileHover={!reducedMotion ? { scale: 1.04 } : undefined}
              whileTap={!reducedMotion  ? { scale: 0.98 } : undefined}
              className={btnPulse && !reducedMotion ? "cta-btn-pulse" : ""}
            >
              <Link
                to={ROUTES.signup}
                className="hero-btn-primary"
                style={{ padding: "0.875rem 1.75rem", fontSize: "1rem", boxShadow: "0 12px 32px rgba(0,0,0,0.35)" }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                aria-label="Create a student account"
              >
                <span>Create a student account</span>
                <ArrowRight size={18} className="hero-btn-primary__arrow" aria-hidden="true" />
              </Link>
            </motion.div>
            <Link to={ROUTES.login} className="cta-banner__login-link">
              Already have an account? Log in →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Slim footer row ── */}
      <footer className="slim-footer" aria-label="Site footer">
        <Link to={ROUTES.home} className="slim-footer__brand" aria-label="PRESTAR home" style={{ textDecoration: "none" }}>
          <span className="slim-footer__logo-wrap"><Logo height={22} /></span>
          <span className="slim-footer__tagline">Online library borrowing system</span>
        </Link>
        <nav className="slim-footer__links" aria-label="Footer navigation">
          <Link to={ROUTES.contact} className="slim-footer__link">Contact</Link>
          <Link to={ROUTES.terms}   className="slim-footer__link">Terms</Link>
          <Link to={ROUTES.privacy} className="slim-footer__link">Privacy</Link>
        </nav>
      </footer>
    </div>
  );
}
