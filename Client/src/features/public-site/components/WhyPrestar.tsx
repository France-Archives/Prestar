import React, { useCallback } from "react";
import { Clock, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ROUTES } from "@/app/routeConfig";
import { useScreenEnter } from "@/hooks/useScreenEnter";
import { fadeIn, animTo } from "@/lib/motion";
import "../styles/landing.css";

export default function WhyPrestar() {
  const reducedMotion = useReducedMotion() ?? false;

  const sectionRef = useScreenEnter(
    useCallback(async (el: HTMLElement, reduced: boolean) => {
      const primary = el.querySelector<HTMLElement>(".why-card--primary");
      const subs    = el.querySelectorAll<HTMLElement>(".why-subgrid .why-card");

      [primary, ...Array.from(subs)].forEach(c => {
        if (!c) return;
        c.style.opacity = "0";
        c.style.transform = reduced ? "none" : (c === primary ? "translateX(-60px)" : "translateX(60px)");
      });

      if (reduced) {
        if (primary) fadeIn(primary, 0);
        Array.from(subs).forEach((c, i) => fadeIn(c, i * 0.1));
        return;
      }

      const promises: Promise<void>[] = [];
      if (primary) promises.push(animTo(primary, { opacity: 1, transform: "none" }, { duration: 0.6, delay: 0.05 }));
      Array.from(subs).forEach((c, i) => {
        promises.push(animTo(c, { opacity: 1, transform: "none" }, { duration: 0.6, delay: 0.15 + i * 0.12 }));
      });
      await Promise.all(promises);
    }, []),
    0.5
  );

  return (
    <section
      id="why-prestar"
      className="land-section why-section land-grain"
      aria-label="Why PRESTAR"
      ref={el => { (sectionRef as React.MutableRefObject<HTMLElement | null>).current = el; }}
    >
      <div className="land-container">
        <div className="land-header">
          <span className="land-eyebrow">Smart library infrastructure</span>
          <h2 className="land-title">Why <em>PRESTAR</em></h2>
          <p className="land-subtitle">
            Designed for university life — avoiding line stand-bys, lost copies, and administrative roadblocks.
          </p>
        </div>

        <div className="why-grid">
          {/* Left Large Feature Card */}
          <motion.div
            className="why-card why-card--primary"
            style={{ opacity: 0, transform: "translateX(-60px)" }}
            whileHover={!reducedMotion ? { rotateX: -3, rotateY: 4, y: -6 } : undefined}
          >
            <div>
              <div className="why-card__icon-wrap">
                <Sparkles size={28} />
              </div>
              <span className="why-card__badge">AUTOMATED DISPATCH</span>
              <h3 style={{ marginTop: "1rem", fontSize: "1.75rem" }}>
                Request online, pick up in person
              </h3>
              <p style={{ fontSize: "1.05rem", lineHeight: 1.7, marginTop: "0.75rem" }}>
                No more wandering the stacks hoping a book is on the shelf. Browse the real-time catalog, submit your request from your laptop or phone, and library staff will pull and hold the title for you at the circulation desk.
              </p>
            </div>

            <div style={{ marginTop: "2rem" }}>
              <Link to={ROUTES.signup} className="hero-btn-primary" style={{ padding: "0.75rem 1.25rem", fontSize: "0.9rem" }}>
                <span>Try it now</span>
                <ArrowRight size={16} className="hero-btn-primary__arrow" />
              </Link>
            </div>
          </motion.div>

          {/* Right Column with 2 Stacked Cards */}
          <div className="why-subgrid">
            {/* Feature 2: Smart Reservation Queue */}
            <motion.div
              className="why-card"
              style={{ opacity: 0, transform: "translateX(60px)" }}
              whileHover={!reducedMotion ? { rotateX: -2, rotateY: 3, y: -4 } : undefined}
            >
              <div className="why-card__icon-wrap"><Clock size={24} /></div>
              <span className="why-card__badge">FAIR QUEUEING</span>
              <h3 style={{ marginTop: "0.75rem" }}>Smart reservation queue</h3>
              <p>
                When all physical copies are checked out, join the automated waiting list. The moment a book is returned and scanned, PRESTAR reserves it for the next student in line and holds it for 24 hours.
              </p>
            </motion.div>

            {/* Feature 3: Real-time COR Verification */}
            <motion.div
              className="why-card"
              style={{ opacity: 0, transform: "translateX(60px)" }}
              whileHover={!reducedMotion ? { rotateX: -2, rotateY: 3, y: -4 } : undefined}
            >
              <div className="why-card__icon-wrap"><ShieldCheck size={24} /></div>
              <span className="why-card__badge">CAMPUS COMPLIANCE</span>
              <h3 style={{ marginTop: "0.75rem" }}>Real-time COR verification</h3>
              <p>
                Submit your semester Certificate of Registration (COR) once per term. Staff verify enrollment quickly so book loans stay prioritized for enrolled students in good standing.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
