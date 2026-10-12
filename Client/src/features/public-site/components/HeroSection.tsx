import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import "../styles/landing.css";

export default function HeroSection() {
  const next = () => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });

  return (
    <section className="land-screen land-hero">
      <div className="land-hero__inner">
        <span className="land-eyebrow">University library</span>
        <h1>Find it. Request it. Pick it up.</h1>
        <p>
          PRESTAR is the online library borrowing system. Browse the catalog, request books, reserve what is out, and collect them at the library.
        </p>
        <div className="row-actions">
          <Link to={ROUTES.signup} className="btn btn-accent" style={{ textDecoration: "none" }}>
            Create a student account →
          </Link>
          <Link to={ROUTES.login} className="btn land-btn-outline" style={{ textDecoration: "none" }}>
            Log in
          </Link>
        </div>
      </div>

      {/* the photo is a decorative card, so the text never sits on top of it */}
      <div className="land-hero__art" role="img" aria-label="A green library bookshelf" />

      <button type="button" className="land-cue" onClick={next} aria-label="Scroll to how it works">
        <ChevronDown size={22} aria-hidden="true" />
      </button>
    </section>
  );
}