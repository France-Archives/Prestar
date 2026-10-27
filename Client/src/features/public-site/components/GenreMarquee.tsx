import { useReducedMotion } from "motion/react";
import "../styles/landing.css";

const GENRES = [
  "Computer Science",
  "Artificial Intelligence",
  "Philippine History & Culture",
  "Education & Pedagogy",
  "Psychology & Human Behavior",
  "Software Engineering",
  "Cybersecurity",
  "Database Systems",
  "Mathematics",
  "Physics",
  "Art & Industrial Design",
  "Environmental Science",
  "Web Development",
  "Astronomy & Earth Science",
  "Biology",
  "Chemistry",
  "Business & Economics",
  "World Literature",
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
