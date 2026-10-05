type LogoProps = { onClick?: () => void };

const style = {
  fontFamily: "var(--serif, Georgia, serif)",
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: "0.12em",
  color: "var(--forest, #07352C)",
  background: "none",
  border: 0,
  padding: 0,
} as const;

// PLACEHOLDER LOGO: text only. Replace with the real PRESTAR logo later.
// It is a button when it has an onClick (header, sidebar) and plain text otherwise (login page).
export default function Logo({ onClick }: LogoProps) {
  if (!onClick) return <span style={style}>PRESTAR</span>;
  return (
    <button type="button" onClick={onClick} aria-label="PRESTAR home" style={{ ...style, cursor: "pointer" }}>
      PRESTAR
    </button>
  );
}