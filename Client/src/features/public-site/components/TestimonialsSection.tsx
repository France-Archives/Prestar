import React, { useCallback, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import { useScreenEnter } from "@/hooks/useScreenEnter";
import { staggerIn, fadeIn } from "@/lib/motion";
import "../styles/landing.css";

const TESTIMONIALS = [
  {
    id: "t1",
    quote: "No more rushing to the circulation desk between lectures. I requested my operating systems and algorithms textbooks online and picked them up at the counter in under two minutes.",
    name: "Maria Santos",
    degree: "BS Computer Science, 3rd Year",
    college: "College of Computer Studies",
    initials: "MS",
    tone: "#0b3d32",
    rotate: -1.2,
  },
  {
    id: "t2",
    quote: "The reservation queue saved my midterms. When all physical copies of Pedagogy were out, PRESTAR automatically secured the next returned copy and held it for 24 hours.",
    name: "David Reyes",
    degree: "Bachelor of Secondary Education, 4th Year",
    college: "College of Education",
    initials: "DR",
    tone: "#8c6430",
    rotate: 1.2,
  },
  {
    id: "t3",
    quote: "Uploading my semester COR took sixty seconds. Once approved, borrowing required reading for Philippine history and literature has been completely frictionless.",
    name: "Angela Cruz",
    degree: "BA Communication, 2nd Year",
    college: "College of Arts & Letters",
    initials: "AC",
    tone: "#335c67",
    rotate: -0.8,
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
          <h2 className="land-title">Voices Across the <em>Campus</em></h2>
          <p className="land-subtitle">
            How students and faculty across academic departments spend less time queuing and more time learning.
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                <span style={{ fontSize: "1.75rem", fontFamily: "var(--font-serif)", color: "var(--color-amber)", lineHeight: 1 }}>“</span>
                <span style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.06em", color: "#2f6f57", background: "rgba(47,111,87,0.1)", padding: "2px 8px", borderRadius: "4px" }}>
                  VERIFIED BORROWER
                </span>
              </div>
              <p className="testimonial-quote" style={{ marginTop: 0 }}>{item.quote}</p>
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
                  <span style={{ fontSize: "0.7rem", color: "var(--color-muted)", opacity: 0.8 }}>{item.college}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
