import logo from "@/assets/images/prestar-logo.png"; // <-- your logo file

// Fixed height + auto width keeps the aspect ratio. Never set both width and height here.
const SIZES = {
  sm: "h-7",
  md: "h-8 md:h-9",
  lg: "h-12 md:h-14",
} as const;

interface LogoProps {
  size?: keyof typeof SIZES;
  className?: string;
}

/** The one PRESTAR logo. Used by every navbar, drawer, auth page and footer. */
export default function Logo({ size = "md", className = "" }: LogoProps) {
  return (
    <img
      src={logo}
      alt="PRESTAR"
      decoding="async"
      className={`block w-auto max-w-[170px] object-contain ${SIZES[size]} ${className}`}
    />
  );
}