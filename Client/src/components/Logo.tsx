import logoImg from "../assets/prestar-logo.png";
import "./Logo.css";

type LogoProps = { onClick?: () => void };

// Shows the real PRESTAR logo image (src/assets/prestar-logo.png).
// Size is controlled in Logo.css (.logo = 44px tall) so you never set it here.
// - With onClick (navbar, drawer): renders as a button that goes home.
// - Without onClick (auth pages, landing): renders as a plain, non-clickable logo.
export default function Logo({ onClick }: LogoProps) {
  const img = <img src={logoImg} alt="PRESTAR" />;

  if (!onClick) return <span className="logo">{img}</span>;

  return (
    <button type="button" className="logo" onClick={onClick} aria-label="PRESTAR home">
      {img}
    </button>
  );
}