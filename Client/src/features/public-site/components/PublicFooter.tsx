import { Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";

export default function PublicFooter() {
  return (
    <footer className="border-t border-line bg-forest text-cream">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <strong className="text-lg">PRESTAR</strong>
          <p className="text-sm opacity-80">Online library borrowing system.</p>
        </div>
        <nav className="flex flex-wrap gap-4 text-sm" aria-label="Footer">
          <Link to={ROUTES.contact} style={{ color: "inherit" }}>Contact</Link>
          <Link to={ROUTES.terms} style={{ color: "inherit" }}>Terms</Link>
          <Link to={ROUTES.privacy} style={{ color: "inherit" }}>Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}