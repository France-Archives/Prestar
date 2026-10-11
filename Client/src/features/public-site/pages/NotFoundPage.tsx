import { Link } from "react-router-dom";
import { homePathFor, ROUTES } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";

export default function NotFoundPage() {
  const { user } = useAuth();
  return (
    <div className="page">
      <div className="empty" style={{ maxWidth: 520, margin: "40px auto" }}>
        <h1>Page not found</h1>
        <p className="subtle">The page you are looking for does not exist or has moved.</p>
        <Link to={user ? homePathFor(user) : ROUTES.home} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }}>
          {user ? "Go to my dashboard" : "Go to the home page"}
        </Link>
      </div>
    </div>
  );
}