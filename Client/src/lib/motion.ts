/** Shared motion language for PRESTAR. One config, consistent feel. */
export const MOTION = {
  duration: { fast: 0.18, base: 0.35, slow: 0.55, xslow: 0.8 },
  ease: {
    out: [0.22, 0.8, 0.3, 1] as [number, number, number, number],
    outExpo: [0.16, 1, 0.3, 1] as [number, number, number, number],
    spring: { type: "spring" as const, stiffness: 280, damping: 28 },
    springGentle: { type: "spring" as const, stiffness: 120, damping: 22 },
    springBounce: { type: "spring" as const, stiffness: 400, damping: 20 },
  },
  stagger: { fast: 0.04, base: 0.08, slow: 0.14 },
} as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

export const staggerParent = (stagger = 0.08, delay = 0) => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.88 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

/**
 * Imperative animation helpers — used by useScreenEnter callbacks.
 * Each helper queries the section's own DOM, resets state, then sequences in.
 * Using Web Animations API + motion/react's `animate` for JS-driven sequences.
 */

const E = [0.16, 1, 0.3, 1]; // shared easing

/** Reset a list of elements to their "hidden" state in one shot */
export function reset(
  els: NodeListOf<Element> | Element[],
  from: { opacity?: number; transform?: string }
) {
  Array.from(els).forEach((el) => {
    const h = el as HTMLElement;
    if (from.opacity !== undefined) h.style.opacity = String(from.opacity);
    if (from.transform !== undefined) h.style.transform = from.transform;
    h.style.transition = "none";
  });
}

/** Animate one element to a target state, returning a Promise */
export function animTo(
  el: Element,
  to: { opacity?: number; transform?: string },
  opts: { duration?: number; delay?: number; easing?: number[] } = {}
): Promise<void> {
  const h = el as HTMLElement;
  const dur = (opts.duration ?? 0.55) * 1000;
  const delay = (opts.delay ?? 0) * 1000;
  const easing = `cubic-bezier(${(opts.easing ?? E).join(",")})`;

  return new Promise((resolve) => {
    const props: Record<string, string[]> = {};
    if (to.opacity !== undefined) {
      props.opacity = [h.style.opacity || "0", String(to.opacity)];
    }
    if (to.transform !== undefined) {
      props.transform = [h.style.transform || "none", to.transform];
    }
    const anim = h.animate(props as unknown as Keyframe[], {
      duration: dur,
      delay,
      easing,
      fill: "forwards",
    });
    anim.onfinish = () => {
      // Commit final state to inline style so it persists after animation fill
      if (to.opacity !== undefined) h.style.opacity = String(to.opacity);
      if (to.transform !== undefined) h.style.transform = to.transform;
      h.style.transition = "";
      resolve();
    };
    anim.oncancel = () => resolve();
  });
}

/** Simple fade — for reduced-motion fallback */
export async function fadeIn(
  el: Element,
  delay = 0,
  duration = 0.4
): Promise<void> {
  return animTo(el, { opacity: 1, transform: "none" }, { delay, duration });
}

/** Stagger an array of elements with a base delay offset */
export function staggerIn(
  els: Element[],
  fromTransform: string,
  {
    stagger = 0.1,
    duration = 0.55,
    baseDelay = 0,
    easing = E,
    bounce = false,
  }: {
    stagger?: number;
    duration?: number;
    baseDelay?: number;
    easing?: number[];
    bounce?: boolean;
  } = {}
): Promise<void>[] {
  return els.map((el, i) => {
    const h = el as HTMLElement;
    h.style.opacity = "0";
    h.style.transform = fromTransform;
    const e = bounce
      ? [0.34, 1.56, 0.64, 1]
      : easing;
    return animTo(el, { opacity: 1, transform: "none" }, {
      delay: baseDelay + i * stagger,
      duration,
      easing: e,
    });
  });
}
