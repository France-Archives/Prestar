import logoSrc from "@/assets/images/prestar-logo.png";

interface LogoProps {
  /** Rendered height in px. Width follows the image's aspect ratio. */
  height?: number;
  className?: string;
}

// One shared brand mark. Place the image at src/assets/images/prestar-logo.png.
export default function Logo({ height = 44, className = "" }: LogoProps) {
  return <img src={logoSrc} alt="PRESTAR" className={`brand-logo ${className}`} style={{ height }} />;
}