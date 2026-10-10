import { Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import BookShelf, { type ShelfItem } from "@/features/books/components/BookShelf";

// PLACEHOLDER: the catalog endpoints need a signed-in user (C1), so this public section shows a fixed sample.
// Replace with a public featured-books endpoint if the team adds one (TO CONFIRM).
const SAMPLE = ["Atomic Habits", "Clean Code", "Sapiens", "Educated", "The Design of Everyday Things", "Deep Work"];

const ITEMS: ShelfItem[] = SAMPLE.map((title) => ({ id: title, title, coverUrl: null, href: ROUTES.login }));

export default function FeaturedBooks() {
  return (
    <section style={{ borderTop: "1px solid var(--color-line)" }}>
      <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-8">
        <h2>Browse the collection</h2>
        <p className="subtle" style={{ margin: "4px 0 16px" }}>
          A taste of what is on the shelves. Log in to see live availability.
        </p>
        <BookShelf items={ITEMS} />
        <p style={{ marginTop: 6 }}>
          <Link to={ROUTES.login} className="link-btn">
            Log in to browse the catalog →
          </Link>
        </p>
      </div>
    </section>
  );
}