import React, { useRef, useCallback, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { ROUTES } from "@/app/routeConfig";
import { useScreenEnter } from "@/hooks/useScreenEnter";
import { staggerIn, fadeIn } from "@/lib/motion";
import "../styles/landing.css";

interface FeaturedBook {
  id: string;
  title: string;
  author: string;
  status: "Available" | "Reserved";
  queueCount?: number;
  tone: string;
}

// 8 featured titles in PRESTAR palette
const FEATURED_BOOKS: FeaturedBook[] = [
  {
    id: "1",
    title: "Atomic Habits",
    author: "James Clear",
    status: "Available",
    tone: "#0b3d32",
  },
  {
    id: "2",
    title: "Clean Code",
    author: "Robert C. Martin",
    status: "Available",
    tone: "#1a5c48",
  },
  {
    id: "3",
    title: "Sapiens",
    author: "Yuval Noah Harari",
    status: "Reserved",
    queueCount: 2,
    tone: "#8c6430",
  },
  {
    id: "4",
    title: "Educated",
    author: "Tara Westover",
    status: "Available",
    tone: "#9e2a2b",
  },
  {
    id: "5",
    title: "The Design of Everyday Things",
    author: "Don Norman",
    status: "Available",
    tone: "#335c67",
  },
  {
    id: "6",
    title: "Deep Work",
    author: "Cal Newport",
    status: "Reserved",
    queueCount: 1,
    tone: "#07352c",
  },
  {
    id: "7",
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    status: "Available",
    tone: "#b98a4a",
  },
  {
    id: "8",
    title: "Algorithms to Live By",
    author: "Brian Christian",
    status: "Available",
    tone: "#2f6f57",
  },
];

export default function FeaturedBooks() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion() ?? false;

  const scrollLeft  = () => carouselRef.current?.scrollBy({ left: -280, behavior: "smooth" });
  const scrollRight = () => carouselRef.current?.scrollBy({ left: 280,  behavior: "smooth" });

  // Books drop from above onto the shelf, one by one, with a bounce
  const sectionRef = useScreenEnter(
    useCallback(async (el: HTMLElement, reduced: boolean) => {
      const books = el.querySelectorAll<HTMLElement>(".shelf-book-item");
      if (reduced) {
        Array.from(books).forEach((b, i) => {
          b.style.opacity = "0";
          b.style.transform = "none";
          fadeIn(b, i * 0.06);
        });
        return;
      }
      Array.from(books).forEach(b => {
        b.style.opacity = "0";
        b.style.transform = "translateY(-55px)";
      });
      staggerIn(Array.from(books), "translateY(-55px)", {
        stagger: 0.1,
        duration: 0.58,
        bounce: true,
        baseDelay: 0.1,
      });
    }, []),
    0.5
  );

  return (
    <section
      className="land-section books-section"
      aria-label="Featured Collection"
      ref={el => { (sectionRef as React.MutableRefObject<HTMLElement | null>).current = el; }}
    >
      <div className="land-container">
        <div className="shelf-controls">
          <div>
            <span className="land-eyebrow">The collection</span>
            <h2 className="land-title" style={{ marginBottom: "0.25rem" }}>
              Browse the <em>collection</em>
            </h2>
            <p className="land-subtitle">
              A preview of popular campus holdings. Sign in to view live copy availability and reserve titles.
            </p>
          </div>

          <div className="shelf-arrows" aria-label="Carousel navigation">
            <button type="button" className="shelf-arrow-btn" onClick={scrollLeft}  aria-label="Previous books"><ChevronLeft size={20} /></button>
            <button type="button" className="shelf-arrow-btn" onClick={scrollRight} aria-label="Next books"><ChevronRight size={20} /></button>
          </div>
        </div>

        {/* 3D Bookshelf Carousel */}
        <div className="shelf-container">
          <div ref={carouselRef} className="shelf-carousel">
            {FEATURED_BOOKS.map((book) => (
              <div
                key={book.id}
                className="shelf-book-item"
                style={{ "--book-tone": book.tone, opacity: 0, transform: "translateY(-55px)" } as CSSProperties}
              >
                {/* Tooltip on Hover */}
                <div className="shelf-book-tooltip" role="tooltip">
                  <div style={{ fontWeight: 600 }}>{book.title}</div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.85 }}>{book.author}</div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: book.status === "Available" ? "#6f9b78" : "#e09f3e",
                      marginTop: 2,
                    }}
                  >
                    {book.status === "Available"
                      ? "• Available to borrow"
                      : `• ${book.queueCount} in waitlist`}
                  </div>
                </div>

                {/* 3D Book */}
                <div className="shelf-book3d">
                  {/* Front Face */}
                  <div className="shelf-book3d__face shelf-book3d__front">
                    <div style={{ width: 22, height: 2, background: "var(--color-amber)", borderRadius: 1 }} />
                    <div>
                      <h3
                        style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          lineHeight: 1.25,
                          marginBottom: "0.25rem",
                          color: "#fff",
                        }}
                      >
                        {book.title}
                      </h3>
                      <p style={{ fontSize: "0.7rem", opacity: 0.85, color: "#fff" }}>{book.author}</p>
                    </div>
                    <span style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", color: "var(--color-amber-soft)" }}>
                      PRESTAR
                    </span>
                  </div>

                  {/* Back Face */}
                  <div className="shelf-book3d__face shelf-book3d__back" />

                  {/* Spine Face */}
                  <div className="shelf-book3d__spine">
                    <span
                      style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                        fontSize: "0.625rem",
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        color: "rgba(255, 255, 255, 0.85)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {book.title}
                    </span>
                  </div>

                  {/* Pages Face */}
                  <div className="shelf-book3d__pages" />
                </div>
              </div>

            ))}
          </div>

          {/* Wooden Shelf Plank */}
          <div className="shelf-plank" aria-hidden="true" />
        </div>

        <div style={{ marginTop: "2.5rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem" }}>
          <Link to={ROUTES.login} className="hero-btn-primary" style={{ textDecoration: "none" }}>
            <span>Log in to browse full catalog</span>
            <ArrowRight size={18} className="hero-btn-primary__arrow" aria-hidden="true" />
          </Link>
          <Link to={ROUTES.contact} className="hero-btn-secondary" style={{ textDecoration: "none" }}>
            Questions? Contact the library
          </Link>
        </div>
      </div>
    </section>
  );
}