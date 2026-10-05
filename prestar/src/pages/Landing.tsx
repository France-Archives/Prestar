import { Link } from "react-router-dom";
import Logo from "../components/Logo";

// PLACEHOLDER LANDING PAGE: replace with the real landing page (design document, Part 4.1).
export default function Landing() {
  return (
    <main className="auth-page">
      <header className="auth-top">
        <Logo />
        <Link to="/login" className="muted-link">Log in</Link>
      </header>
      <div className="plain-card">
        <h1>Find it. Reserve it. Borrow it.</h1>
        <p>PRESTAR is your university library, online.</p>
        <Link className="btn primary" to="/signup">Create account</Link>
        <Link className="btn ghost" to="/login">Log in</Link>
      </div>
    </main>
  );
}