// src/components/AuthHeader.jsx
import { Link, useNavigate } from "react-router-dom";
import Logo from "./Logo.jsx";

// Shared header for Login, Sign Up and Verify Email.
export default function AuthHeader() {
  const navigate = useNavigate();
  return (
    <header className="auth-top">
      <Logo onClick={() => navigate("/")} />
      <Link to="/" className="back-link"><span aria-hidden="true">←</span> Back to Home</Link>
    </header>
  );
}