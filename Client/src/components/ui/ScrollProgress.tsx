import { useScroll, useTransform, motion } from "motion/react";

/** Thin gold bar at top of page tracking scroll progress. */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "3px",
        background: "var(--color-amber)",
        scaleX,
        transformOrigin: "left",
        zIndex: 200,
      }}
    />
  );
}
