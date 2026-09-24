import { useEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "./motion";

type Options = {
  /** Peak rotation, in degrees, at the far edge of the catch area. */
  maxTilt?: number;
  /** Peak drift toward the pointer, in px. */
  maxShift?: number;
};

/**
 * Makes the pass lean toward the pointer.
 *
 * Returns a ref for the element that tilts; the element's parent becomes the
 * catch area, so the pass starts leaning as the pointer approaches rather than
 * only once it is on top of it.
 *
 * Driven by `gsap.quickTo`, which interpolates toward each new target instead
 * of snapping to it — the pass trails the pointer with a little weight rather
 * than tracking it rigidly, and GSAP batches the writes into its own ticker so
 * there is no per-frame layout read. Reads still come from the catch area,
 * never from the tilting element, so a measurement can't feed back into the
 * transform it caused.
 */
export function useMagneticTilt(
  enabled: boolean,
  { maxTilt = 9, maxShift = 9 }: Options = {},
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = ref.current;
    const area = target?.parentElement;
    if (!target || !area) return;

    const settle = () => {
      gsap.to(target, {
        rotationX: 0,
        rotationY: 0,
        x: 0,
        y: 0,
        duration: 0.7,
        ease: "power3.out",
      });
    };

    if (!enabled || prefersReducedMotion()) {
      gsap.set(target, { rotationX: 0, rotationY: 0, x: 0, y: 0 });
      return;
    }

    gsap.set(target, { transformPerspective: 1400, transformOrigin: "center" });

    const spring = { duration: 0.55, ease: "power3" };
    const rotX = gsap.quickTo(target, "rotationX", spring);
    const rotY = gsap.quickTo(target, "rotationY", spring);
    const moveX = gsap.quickTo(target, "x", spring);
    const moveY = gsap.quickTo(target, "y", spring);

    const onMove = (e: PointerEvent) => {
      const r = area.getBoundingClientRect();
      const nx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2));
      const ny = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2));

      rotX(-ny * maxTilt);
      rotY(nx * maxTilt);
      moveX(nx * maxShift);
      moveY(ny * maxShift);
    };

    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerleave", settle);

    return () => {
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerleave", settle);
      if (target.isConnected) gsap.killTweensOf(target);
    };
  }, [enabled, maxTilt, maxShift]);

  return ref;
}

function clamp(v: number, limit = 1): number {
  return Math.max(-limit, Math.min(limit, v));
}
