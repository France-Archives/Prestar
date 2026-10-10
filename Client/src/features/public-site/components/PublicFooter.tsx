import { Link } from "react-router-dom";
import Logo from "@/components/common/Logo";
import { ROUTES } from "@/app/routeConfig";

export default function PublicFooter() {
  return (
    <footer className="border-t border-line bg-forest text-cream">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          {/* Cream chip so the logo stays readable on the dark green footer. */}
          <Link to={ROUTES.home} className="inline-flex rounded-lg bg-cream px-3 py-1.5" aria-label="PRESTAR home" style={{ textDecoration: "none" }}>
            <Logo size="sm" />
          </Link>
          <p className="mt-2 text-sm opacity-80">Online library borrowing system.</p>
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