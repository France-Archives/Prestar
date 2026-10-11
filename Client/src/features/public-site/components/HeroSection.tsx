import { Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import "../styles/landing.css";

export default function HeroSection() {
  return (
    <section className="hero">
      <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-8 sm:py-14">
        <span className="eyebrow" style={{ color: "var(--color-amber)" }}>
          University library
        </span>
        <h1 style={{ maxWidth: 720 }}>Find it. Request it. Pick it up.</h1>
        <p style={{ maxWidth: 560, margin: "12px 0 22px", fontSize: "1.0625rem", opacity: 0.9 }}>
          PRESTAR is the online library borrowing system. Browse the catalog, request books, reserve what is out, and collect them at the library.
        </p>
        <div className="row-actions">
          <Link to={ROUTES.signup} className="btn btn-accent" style={{ textDecoration: "none" }}>
            Create a student account
          </Link>
          <Link to={ROUTES.login} className="btn btn-ghost" style={{ textDecoration: "none" }}>
            Log in
          </Link>
        </div>
      </div>
    </section>
  );
}