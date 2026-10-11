import { useLocation, useNavigate } from "react-router-dom";

interface BackButtonProps {
  /** Where to go when the page was opened directly (no earlier in-app page). */
  fallback: string;
  label?: string;
}

// Goes to the previous in-app page. location.key is "default" only for the first entry of a session,
// so a page opened directly falls back to a sensible section page instead of leaving the site.
export default function BackButton({ fallback, label = "Back" }: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const go = () => (location.key !== "default" ? navigate(-1) : navigate(fallback, { replace: true }));
  return (
    <button type="button" className="back-btn" onClick={go} aria-label={`${label} to the previous page`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
      {label}
    </button>
  );
}