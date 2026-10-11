import { passwordChecks, passwordScore } from "@/utils/validators";

const COLORS = ["var(--color-line)", "var(--color-brick)", "var(--color-amber)", "var(--color-green)", "var(--color-forest)"];
const LABELS = ["", "Weak", "Fair", "Good", "Strong"];

// Display only. The backend applies the real password policy (TC-03).
export default function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = passwordScore(password);
  return (
    <div className="stack" style={{ gap: 6 }} aria-live="polite">
      <div className="strength-bar" role="img" aria-label={`Password strength: ${LABELS[score] || "very weak"}`}>
        <div style={{ width: `${(score / 4) * 100}%`, background: COLORS[score] }} />
      </div>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 2, fontSize: "0.75rem" }}>
        {passwordChecks(password).map((c) => (
          <li key={c.label} style={{ color: c.ok ? "var(--color-green)" : "var(--color-muted)" }}>
            {c.ok ? "✓" : "○"} {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}