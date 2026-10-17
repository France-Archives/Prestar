import React, { useCallback, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useScreenEnter } from "@/hooks/useScreenEnter";
import { staggerIn, fadeIn } from "@/lib/motion";
import "../styles/landing.css";

// PLACEHOLDER: Replace with real student testimonials
const TESTIMONIALS = [
  {
    id: "t1",
    // PLACEHOLDER: Replace with real student testimonials
    quote: "No more waiting in long lines between classes. I requested my engineering textbooks the night before and picked them up at the counter in under two minutes.",
    name: "Maria Santos", degree: "BS Computer Science, 3rd Year", initials: "MS", tone: "#0b3d32", rotate: -1.2,
  },
  {
    id: "t2",
    // PLACEHOLDER: Replace with real student testimonials
    quote: "The reservation queue saved my finals prep! When all copies of Operating Systems were out, PRESTAR held one for me the second another student returned it.",
    name: "David Reyes", degree: "BS Information Technology, 4th Year", initials: "DR", tone: "#8c6430", rotate: 1.5,
  },
  {
    id: "t3",
    // PLACEHOLDER: Replace with real student testimonials
    quote: "Submitting my COR online took sixty seconds. Once verified, borrowing research literature throughout the whole term has been completely seamless.",
    name: "Angela Cruz", degree: "BA Communication, 2nd Year", initials: "AC", tone: "#335c67", rotate: -0.8,
  },
];

export default function TestimonialsSection() {
  const reducedMotion = useReducedMotion() ?? false;

  const sectionRef = useScreenEnter(
    useCallback(async (el: HTMLElement, reduced: boolean) => {
      const avatars = el.querySelectorAll<HTMLElement>(".testimonial-avatar");
      const cards   = el.querySelectorAll<HTMLElement>(".testimonial-card");

      // Reset
      Array.from(avatars).forEach(a => { a.style.opacity = "0"; a.style.transform = "scale(0.5)"; });
      Array.from(cards).forEach(c => { c.style.opacity = "0"; c.style.transform = "translateY(24px)"; });

      if (reduced) {
        Array.from(avatars).forEach((a, i) => fadeIn(a, i * 0.08));
        Array.from(cards).forEach((c, i) => fadeIn(c, i * 0.1));
        return;
      }

      // Avatars pop in with spring bounce
      staggerIn(Array.from(avatars), "scale(0.5)", { stagger: 0.1, duration: 0.45, bounce: true, baseDelay: 0 });
      // Cards fade up, overlapping with avatars
      staggerIn(Array.from(cards), "translateY(24px)", { stagger: 0.12, duration: 0.6, baseDelay: 0.15 });
    }, []),
    0.5
  );

  return (
    <section
      className="land-section testimonials-section"
      aria-label="Student Testimonials"
      ref={el => { (sectionRef as React.MutableRefObject<HTMLElement | null>).current = el; }}
    >
      <div className="land-container">
        <div className="land-header">
          <span className="land-eyebrow">Campus feedback</span>
          <h2 className="land-title">What <em>students</em> say</h2>
          <p className="land-subtitle">
            How PRESTAR helps university students spend less time queuing and more time learning.
          </p>
        </div>

        <div className="testimonials-grid">
          {TESTIMONIALS.map((item) => (
            <div
              key={item.id}
              className="testimonial-card"
              style={!reducedMotion
                ? { opacity: 0, transform: "translateY(24px)", rotate: `${item.rotate}deg` }
                : { rotate: `${item.rotate}deg` }
              }
            >
              {/* PLACEHOLDER: Replace with real student testimonials */}
              <p className="testimonial-quote">{item.quote}</p>
              <div className="testimonial-author">
                <div
                  className="testimonial-avatar"
                  style={{
                    "--avatar-tone": item.tone,
                    opacity: 0,
                    transform: "scale(0.5)",
                  } as CSSProperties}
                >
                  {item.initials}
                </div>
                <div className="testimonial-meta">
                  <h4>{item.name}</h4>
                  <span>{item.degree}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
