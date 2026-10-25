import { useReducedMotion } from "motion/react";
import "../styles/landing.css";

const GENRES = [
  "Fiction",
  "Science",
  "History",
  "Philosophy",
  "Technology",
  "Literature",
  "Psychology",
  "Arts",
  "Education",
  "Law",
  "Medicine",
  "Engineering",
  "Mathematics",
  "Economics",
];

export default function GenreMarquee() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="genre-section" aria-label="Book Categories">
      <div className="genre-marquee-wrap">
        <div className="genre-marquee-track">
          {GENRES.map((genre) => (
            <span key={`g1-${genre}`} className="genre-pill">
              {genre}
            </span>
          ))}
        </div>
        {!reducedMotion && (
          <div className="genre-marquee-track" aria-hidden="true">
            {GENRES.map((genre) => (
              <span key={`g2-${genre}`} className="genre-pill">
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
