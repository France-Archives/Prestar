import React, { useCallback } from "react";
import { Clock, ShieldCheck, Sparkles, MapPin, ArrowRight, CheckCircle2 } from "lucide-react";
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
      const cards = el.querySelectorAll<HTMLElement>(".why-card");

      cards.forEach(c => {
        c.style.opacity = "0";
        c.style.transform = reduced ? "none" : "translateY(24px)";
      });

      if (reduced) {
        cards.forEach((c, i) => fadeIn(c, i * 0.08));
        return;
      }

      const promises: Promise<void>[] = [];
      cards.forEach((c, i) => {
        promises.push(animTo(c, { opacity: 1, transform: "none" }, { duration: 0.55, delay: 0.08 + i * 0.1 }));
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
        <div className="land-header" style={{ marginBottom: "2.5rem" }}>
          <h2 className="land-title">
            Built for Academic <em>Productivity</em>
          </h2>
          <p className="land-subtitle" style={{ maxWidth: "44rem" }}>
            Eliminating long library counter lines, missing shelf copies, and registration friction with automated university stacks management.
          </p>
        </div>

        <div className="why-bento-grid">
          {/* Card 1: Main Anchor - Automated Stacks Pull & Pickup */}
          <motion.div
            className="why-card why-bento-card--lead"
            whileHover={!reducedMotion ? { y: -4 } : undefined}
          >
            <div className="why-card__top">
              <div className="why-card__icon-wrap">
                <Sparkles size={24} />
              </div>
              <span className="why-card__tag">AUTOMATED DESK DISPATCH</span>
            </div>

            <div className="why-card__body">
              <h3>Request online, collect at the counter in minutes</h3>
              <p>
                Browse live holdings from your phone between lectures. Once requested, circulation librarians pull the title from the stacks and secure it under your name with a 24-hour hold window.
              </p>

              {/* Realistic Reservation Slip Artifact */}
              <div className="why-pickup-slip">
                <div className="why-slip-header">
                  <span>PRESTAR LOAN PASS</span>
                  <span className="why-slip-badge">COUNTER READY</span>
                </div>
                <div className="why-slip-meta">
                  <div className="why-slip-title">Clean Code: Agile Craftsmanship</div>
                  <div className="why-slip-sub">Robert C. Martin • QA 76.76 • Shelf-104</div>
                </div>
                <div className="why-slip-footer">
                  <div className="why-slip-chip">
                    <CheckCircle2 size={13} color="#2f6f57" />
                    <span>24h Hold Active</span>
                  </div>
                  <span className="why-slip-counter">Circulation Desk #1</span>
                </div>
              </div>
            </div>

            <div className="why-card__action">
              <Link to={ROUTES.signup} className="hero-btn-primary" style={{ padding: "0.75rem 1.4rem", fontSize: "0.9rem" }}>
                <span>Get started free</span>
                <ArrowRight size={16} className="hero-btn-primary__arrow" />
              </Link>
            </div>
          </motion.div>

          {/* Card 2: Fair FIFO Waitlist */}
          <motion.div
            className="why-card why-bento-card"
            whileHover={!reducedMotion ? { y: -4 } : undefined}
          >
            <div className="why-card__top">
              <div className="why-card__icon-wrap"><Clock size={22} /></div>
              <span className="why-card__tag">STRICT FIFO FAIRNESS</span>
            </div>
            <h3>Intelligent reservation queue</h3>
            <p>
              When all copies are checked out, join the automated waiting list. The second a book is checked in at the counter, PRESTAR immediately claims and holds it for the next student in line.
            </p>
            <div className="why-queue-preview">
              <div className="why-queue-node is-done">Returned</div>
              <div className="why-queue-arrow">→</div>
              <div className="why-queue-node is-current">You (Position #1)</div>
              <div className="why-queue-arrow">→</div>
              <div className="why-queue-node">Reserved 24h</div>
            </div>
          </motion.div>

          {/* Card 3: Semester COR Verification */}
          <motion.div
            className="why-card why-bento-card"
            whileHover={!reducedMotion ? { y: -4 } : undefined}
          >
            <div className="why-card__top">
              <div className="why-card__icon-wrap"><ShieldCheck size={22} /></div>
              <span className="why-card__tag">CAMPUS VERIFIED</span>
            </div>
            <h3>Active-term COR compliance</h3>
            <p>
              Upload your Certificate of Registration once each semester. Staff review it quickly to guarantee priority access for actively enrolled students in good academic standing.
            </p>
            <div className="why-cor-badge">
              <span className="why-cor-dot" />
              <span>Current Term: 1st Semester 2026–2027 • Enrolled</span>
            </div>
          </motion.div>

          {/* Card 4: Precision Shelf Locator */}
          <motion.div
            className="why-card why-bento-card why-bento-card--wide"
            whileHover={!reducedMotion ? { y: -4 } : undefined}
          >
            <div className="why-card__top">
              <div className="why-card__icon-wrap"><MapPin size={22} /></div>
              <span className="why-card__tag">STACKS NAVIGATION</span>
            </div>
            <h3>Physical shelf coordinates & locator</h3>
            <p>
              Every copy is mapped to exact physical coordinates in the library stacks. Both students and desk librarians locate high-demand textbooks instantly without catalog confusion.
            </p>
            <div className="why-coords-strip">
              <div className="why-coord-pill">
                <span className="why-coord-label">AISLE</span>
                <span className="why-coord-val">04 Stacks</span>
              </div>
              <div className="why-coord-pill">
                <span className="why-coord-label">BAY</span>
                <span className="why-coord-val">Bay B</span>
              </div>
              <div className="why-coord-pill">
                <span className="why-coord-label">SHELF</span>
                <span className="why-coord-val">Shelf-104</span>
              </div>
              <div className="why-coord-pill">
                <span className="why-coord-label">CALL NO</span>
                <span className="why-coord-val">QA 76.76</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
