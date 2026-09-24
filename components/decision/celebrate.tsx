"use client";

import { useEffect } from "react";
import { useReducedMotion } from "framer-motion";

const CONFETTI_COLORS = ["#3a4a26", "#445721", "#5d6b3a", "#bec59b", "#efe9d4"];

async function celebrate() {
  const { default: confetti } = await import("canvas-confetti");
  const shared = {
    colors: CONFETTI_COLORS,
    disableForReducedMotion: true,
    zIndex: 100,
    scalar: 0.9,
  };
  confetti({ ...shared, particleCount: 80, spread: 70, origin: { y: 0.3 } });
  window.setTimeout(() => {
    confetti({
      ...shared,
      particleCount: 50,
      spread: 100,
      startVelocity: 35,
      origin: { x: 0.2, y: 0.35 },
    });
    confetti({
      ...shared,
      particleCount: 50,
      spread: 100,
      startVelocity: 35,
      origin: { x: 0.8, y: 0.35 },
    });
  }, 180);
}

/**
 * The one client component on the accepted letter, and it renders nothing —
 * it exists so arriving at an acceptance still has a moment to it now that the
 * letter is a route rather than a modal that opened.
 *
 * canvas-confetti is imported lazily so it never enters the bundle for a
 * rejection, and the effect is skipped outright under reduced motion rather
 * than relying on the library's own guard.
 */
export function Celebrate() {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    void celebrate();
  }, [reduceMotion]);

  return null;
}
