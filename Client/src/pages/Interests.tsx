import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuthedLibrary } from "../context/LibraryContext";
import { useInterests } from "../hooks/useInterests";
import { saveInterests } from "../services/interests";
import { CONFIG, HOME_BY_ROLE } from "../utils/constants";
import "./Interests.css";

const minMessage = `Choose at least ${CONFIG.MIN_INTERESTS} categor${CONFIG.MIN_INTERESTS === 1 ? "y" : "ies"} to continue.`;

// Shown once, on a student's first login. Also reachable later from "Edit interests" on the dashboard.
export default function Interests() {
  const { db, user, logout, notify } = useAuthedLibrary();
  const navigate = useNavigate();
  const saved = useInterests(user.user_id);

  const categories = [...db.categories].sort((a, b) => a.category_name.localeCompare(b.category_name));

  // A category the library deleted can still be saved on the student. Drop those ids so they are
  // not counted as chips the student cannot see, and so saving does not fail on a missing category.
  const validSaved = saved.filter((id) => db.categories.some((c) => c.category_id === id));
  const firstTime = validSaved.length === 0;

  const [selected, setSelected] = useState<number[]>(validSaved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: number) => {
    setError(null);
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const submit = async () => {
    // Validation feedback: the button stays clickable and explains what is missing.
    if (selected.length < CONFIG.MIN_INTERESTS) {
      setError(minMessage);
      return;
    }
    setSaving(true);
    setError(null);
    // MOCK INTEREST PREFERENCES — REPLACE WITH REAL BACKEND LATER
    const res = await saveInterests(user.user_id, selected);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    notify("Interests saved.");
    navigate(HOME_BY_ROLE.Student, { replace: true });
  };

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <main className="auth-page">
      <header className="auth-top">
        <Logo />
      </header>
      <div className="plain-card interest-card">
        <h1>What types of books are you interested in?</h1>
        <p className="interest-sub">
          Pick the categories you enjoy. We use them to personalize the book recommendations on your dashboard.
        </p>

        {categories.length === 0 ? (
          <p className="muted">No categories are available yet. Please contact the library.</p>
        ) : (
          <div className="interest-grid" role="group" aria-label="Book categories">
            {categories.map((c) => {
              const on = selected.includes(c.category_id);
              return (
                <button
                  key={c.category_id}
                  type="button"
                  className={`interest-chip ${on ? "on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggle(c.category_id)}
                >
                  {on && <span aria-hidden="true">✓</span>}
                  {c.category_name}
                </button>
              );
            })}
          </div>
        )}

        <p className="interest-count muted">
          {selected.length === 0 ? `Choose at least ${CONFIG.MIN_INTERESTS}` : `${selected.length} selected`}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="interest-actions">
          <button className="btn primary" disabled={saving || categories.length === 0} onClick={submit}>
            {saving ? "Saving…" : "Continue"}
          </button>
          {firstTime ? (
            <button type="button" className="text-btn" onClick={signOut} disabled={saving}>
              Sign out
            </button>
          ) : (
            <button type="button" className="text-btn" onClick={() => navigate(HOME_BY_ROLE.Student)} disabled={saving}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </main>
  );
}