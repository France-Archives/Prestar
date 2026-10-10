import { Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";

// PLACEHOLDER: the catalog endpoints need a signed-in user (C1), so this public section shows a fixed sample.
// Replace with a public featured-books endpoint if the team adds one (TO CONFIRM).
const SAMPLE = ["Atomic Habits", "Clean Code", "Sapiens", "Educated", "The Design of Everyday Things", "Deep Work"];

export default function FeaturedBooks() {
  return (
    <section style={{ background: "var(--color-paper)", borderBlock: "1px solid var(--color-line)" }}>
      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-8">
        <h2 style={{ fontSize: "1.6rem" }}>Browse the collection</h2>
        <p className="subtle" style={{ margin: "6px 0 18px" }}>
          A taste of what is on the shelves. Log in to see live availability.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {SAMPLE.map((t) => (
            <span key={t} className="badge badge-ok" style={{ fontSize: "0.8125rem", padding: "6px 14px" }}>
              {t}
            </span>
          ))}
        </div>
        <p style={{ marginTop: 18 }}>
          <Link to={ROUTES.login} className="link-btn">
            Log in to browse the catalog →
          </Link>
        </p>
      </div>
    </section>
  );
}