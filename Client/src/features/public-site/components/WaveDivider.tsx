import type { CSSProperties } from "react";

type WaveVariant = "cream-to-green" | "green-to-cream" | "cream-to-mist" | "mist-to-cream" | "mist-to-green";

const WAVES: Record<WaveVariant, { fill: string; bg: string }> = {
  "cream-to-green": { fill: "#0b3d32", bg: "transparent" },
  "green-to-cream": { fill: "#f5f3ea", bg: "transparent" },
  "cream-to-mist": { fill: "#dce5d7", bg: "transparent" },
  "mist-to-cream": { fill: "#f5f3ea", bg: "transparent" },
  "mist-to-green": { fill: "#0b3d32", bg: "#dce5d7" },
};

export default function WaveDivider({ variant, flip = false }: { variant: WaveVariant; flip?: boolean }) {
  const { fill, bg } = WAVES[variant];
  return (
    <div
      className="wave-divider"
      aria-hidden="true"
      style={{ background: bg, transform: flip ? "scaleX(-1)" : undefined } as CSSProperties}
    >
      <svg
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M0,40 C240,80 480,0 720,40 C960,80 1200,0 1440,40 L1440,80 L0,80 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}
