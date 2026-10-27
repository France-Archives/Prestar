import React, { useRef, useCallback, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { ROUTES } from "@/app/routeConfig";
import { useScreenEnter } from "@/hooks/useScreenEnter";
import { staggerIn, fadeIn } from "@/lib/motion";
import "../styles/landing.css";

interface FeaturedBook {
  id: string;
  title: string;
  author: string;
  category: string;
  accessionNo: string;
  shelf: string;
  status: "Available" | "Reserved";
  copiesAvailable?: number;
  queueCount?: number;
  tone: string;
}

// Curated academic titles from PRESTAR collection
const FEATURED_BOOKS: FeaturedBook[] = [
  {
    id: "101",
    title: "Pedagogy of the Oppressed",
    author: "Paulo Freire",
    category: "Education",
    accessionNo: "ACC-ED-101",
    shelf: "Shelf-102 • Aisle 3",
    status: "Available",
    copiesAvailable: 5,
    tone: "#134a3c",
  },
  {
    id: "2",
    title: "Clean Code",
    author: "Robert C. Martin",
    category: "Computer Science",
    accessionNo: "ACC-CS-002",
    shelf: "Shelf-104 • Aisle 4",
    status: "Available",
    copiesAvailable: 2,
    tone: "#0b3d32",
  },
  {
    id: "102",
    title: "Mindset: The Psychology of Success",
    author: "Carol S. Dweck",
    category: "Psychology",
    accessionNo: "ACC-PS-102",
    shelf: "Shelf-108 • Aisle 2",
    status: "Available",
    copiesAvailable: 4,
    tone: "#8c6430",
  },
  {
    id: "103",
    title: "Make It Stick: Science of Learning",
    author: "Peter C. Brown",
    category: "Education",
    accessionNo: "ACC-ED-103",
    shelf: "Shelf-102 • Aisle 3",
    status: "Reserved",
    queueCount: 2,
    tone: "#9e2a2b",
  },
  {
    id: "5",
    title: "The Design of Everyday Things",
    author: "Don Norman",
    category: "Art and Design",
    accessionNo: "ACC-AD-005",
    shelf: "Shelf-110 • Aisle 1",
    status: "Available",
    copiesAvailable: 3,
    tone: "#335c67",
  },
  {
    id: "104",
    title: "Democracy and Education",
    author: "John Dewey",
    category: "Philosophy",
    accessionNo: "ACC-PH-104",
    shelf: "Shelf-103 • Aisle 3",
    status: "Available",
    copiesAvailable: 5,
    tone: "#07352c",
  },
  {
    id: "24",
    title: "Introduction to Algorithms",
    author: "Thomas H. Cormen",
    category: "Computer Science",
    accessionNo: "ACC-CS-024",
    shelf: "Shelf-104 • Aisle 4",
    status: "Reserved",
    queueCount: 3,
    tone: "#b98a4a",
  },
  {
    id: "3",
    title: "Design Patterns",
    author: "Erich Gamma et al.",
    category: "Software Engineering",
    accessionNo: "ACC-SE-003",
    shelf: "Shelf-104 • Aisle 4",
    status: "Available",
    copiesAvailable: 4,
    tone: "#2f6f57",
  },
];

export default function FeaturedBooks() {
  const carouselRef = useRef<HTMLDivElement>(null);
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
            <h2 className="land-title" style={{ marginBottom: "0.4rem" }}>
              Campus <em>Holdings</em> & Stacks
            </h2>
            <p className="land-subtitle" style={{ maxWidth: "48rem" }}>
              Explore real-time titles across university departments. Verified students can reserve copies online and pick them up directly at the circulation counter.
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
                {/* Catalog Card Tooltip on Hover */}
                <div className="shelf-book-tooltip" role="tooltip">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", color: "#b98a4a", textTransform: "uppercase" }}>
                      {book.category}
                    </span>
                    <span style={{ fontSize: "0.6rem", background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: "3px", fontFamily: "monospace" }}>
                      {book.accessionNo}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", lineHeight: 1.25, color: "#fff" }}>{book.title}</div>
                  <div style={{ fontSize: "0.72rem", opacity: 0.8, color: "var(--color-cream)" }}>{book.author}</div>
                  <div style={{ fontSize: "0.68rem", opacity: 0.65, marginTop: "3px" }}>📍 {book.shelf}</div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: book.status === "Available" ? "#9fe0c2" : "#f0c36a",
                      marginTop: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <span>●</span>
                    {book.status === "Available"
                      ? `${book.copiesAvailable} copies available on shelf`
                      : `In loan • ${book.queueCount} in waitlist`}
                  </div>
                </div>

                {/* 3D Book */}
                <div className="shelf-book3d">
                  {/* Front Face */}
                  <div className="shelf-book3d__face shelf-book3d__front">
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                      <div style={{ width: 18, height: 2, background: "var(--color-amber)", borderRadius: 1 }} />
                      <span style={{ fontSize: "0.5rem", letterSpacing: "0.06em", opacity: 0.8, fontFamily: "monospace" }}>{book.accessionNo}</span>
                    </div>
                    <div>
                      <h3
                        style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          lineHeight: 1.25,
                          marginBottom: "0.2rem",
                          color: "#fff",
                        }}
                      >
                        {book.title}
                      </h3>
                      <p style={{ fontSize: "0.65rem", opacity: 0.85, color: "var(--color-cream)" }}>{book.author}</p>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                      <span style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.1em", color: "var(--color-amber-soft)" }}>
                        PRESTAR
                      </span>
                      <span style={{ fontSize: "0.48rem", color: book.status === "Available" ? "#9fe0c2" : "#f0c36a", fontWeight: 600 }}>
                        {book.status === "Available" ? "ON SHELF" : "WAITLIST"}
                      </span>
                    </div>
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
                        letterSpacing: "0.05em",
                        color: "rgba(255, 255, 255, 0.9)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {book.title}
                    </span>
                    <span style={{ fontSize: "0.45rem", color: "#b98a4a", marginTop: "auto", fontFamily: "monospace" }}>
                      {book.accessionNo.replace("ACC-", "")}
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