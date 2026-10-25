import React, { useCallback, useState } from "react";
import { BookOpen, FileText, Landmark, RefreshCw, User, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useScreenEnter } from "@/hooks/useScreenEnter";
import { animTo, fadeIn } from "@/lib/motion";
import "../styles/landing.css";

interface StepItem {
  num: string;
  title: string;
  text: string;
  icon: LucideIcon;
}

const STEPS: StepItem[] = [
  { num: "01", title: "Sign up and verify",    text: "Create a student account and verify your campus email.",                                                                                  icon: User      },
  { num: "02", title: "Submit your COR",        text: "Upload your Certificate of Registration each term. Library staff quickly review and approve it.",                                         icon: FileText  },
  { num: "03", title: "Request or reserve",     text: "Eligible requests are approved automatically when copies are available. Otherwise, join the intelligent queue.",                           icon: BookOpen  },
  { num: "04", title: "Pick up at the library", text: "Staff confirm your clearance and hand the book over in person. That is when your loan period starts.",                                    icon: Landmark  },
  { num: "05", title: "Return and renew",       text: "Renew online when no peers are waiting. Returns are scanned on the spot, and fees can be settled at the counter.",                        icon: RefreshCw },
];

export default function HowItWorks() {
  const reducedMotion = useReducedMotion() ?? false;
  const [activeStepIndex, setActiveStepIndex] = useState(reducedMotion ? STEPS.length : 0);

  const sectionRef = useScreenEnter(
    useCallback(async (el: HTMLElement, reduced: boolean) => {
      // Grab elements
      const lineH = el.querySelector<HTMLElement>(".how-timeline__line-fill--h");
      const lineV = el.querySelector<HTMLElement>(".how-timeline__line-fill--v");
      const nodes = el.querySelectorAll<HTMLElement>(".how-step__node");
      const cards = el.querySelectorAll<HTMLElement>(".how-step");

      // Reset
      setActiveStepIndex(0);
      if (lineH) { lineH.style.width = "0%"; lineH.style.transition = "none"; }
      if (lineV) { lineV.style.height = "0%"; lineV.style.transition = "none"; }
      Array.from(cards).forEach(c => {
        c.style.opacity = "0";
        c.style.transform = "translateY(22px)";
      });
      Array.from(nodes).forEach(n => n.classList.remove("is-active"));

      if (reduced) {
        // Simple fade for all cards simultaneously
        if (lineH) { lineH.style.transition = "width 0.6s ease"; lineH.style.width = "100%"; }
        if (lineV) { lineV.style.transition = "height 0.6s ease"; lineV.style.height = "100%"; }
        setActiveStepIndex(STEPS.length);
        Array.from(cards).forEach((c, i) => fadeIn(c, i * 0.06));
        return;
      }

      // 1. Cards fade+slide up, staggered
      const STAGGER = 0.12;
      const DUR = 0.55;
      cards.forEach((card, i) => {
        animTo(card, { opacity: 1, transform: "none" }, { delay: i * STAGGER, duration: DUR });
      });

      // 2. Gold line draws simultaneously with step 1
      const totalDur = DUR + STAGGER * (STEPS.length - 1);
      const lineDur = totalDur * 1000;
      if (lineH) {
        lineH.style.transition = `width ${lineDur}ms cubic-bezier(0.16,1,0.3,1)`;
        requestAnimationFrame(() => { lineH.style.width = "100%"; });
      }
      if (lineV) {
        lineV.style.transition = `height ${lineDur}ms cubic-bezier(0.16,1,0.3,1)`;
        requestAnimationFrame(() => { lineV.style.height = "100%"; });
      }

      // 3. Light up each circle at its stagger offset
      for (let i = 0; i < STEPS.length; i++) {
        const delay = 200 + i * (STAGGER * 1000);
        setTimeout(() => setActiveStepIndex(i + 1), delay);
      }
    }, []),
    0.55
  );

  return (
    <section
      id="how-it-works"
      className="land-section how-section"
      aria-label="How it works"
      ref={el => { (sectionRef as React.MutableRefObject<HTMLElement | null>).current = el; }}
    >
      <div className="land-container">
        <div className="land-header">
          <span className="land-eyebrow land-eyebrow--light">Clear, transparent process</span>
          <h2 className="land-title land-title--light">
            A simpler way to <em>borrow</em> books
          </h2>
          <p className="land-subtitle land-subtitle--light">
            From online catalog search to in-person counter pickup, here is exactly how PRESTAR works.
          </p>
        </div>

        <div className="how-timeline">
          {/* 2px gold connector line */}
          <div className="how-timeline__line-bg" aria-hidden="true" />
          <div className="how-timeline__line-fill how-timeline__line-fill--h" aria-hidden="true" style={{ width: "0%" }} />
          <div className="how-timeline__line-fill how-timeline__line-fill--v" aria-hidden="true" style={{ height: "0%" }} />

          <ol className="how-steps-row">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = reducedMotion || idx < activeStepIndex;
              return (
                <motion.li
                  key={step.num}
                  className={`how-step${isActive ? " is-active" : ""}`}
                  style={{ opacity: 0, transform: "translateY(22px)" }}
                >
                  <motion.div
                    className="how-step__node"
                    whileHover={!reducedMotion ? { scale: 1.12, rotate: 6 } : undefined}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <Icon size={24} aria-hidden="true" />
                  </motion.div>
                  <span className="how-step__order">STEP {step.num}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}