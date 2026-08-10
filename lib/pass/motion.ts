import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";

/** One place to ask, so every animation opts out the same way. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Types a string out one character at a time.
 *
 * Drives the DOM node directly rather than React state — a tween that setState
 * on every frame would re-render the whole landing sixty times a second to
 * change one text node.
 */
export function useTypewriter(
  text: string,
  { delay = 0.15, cps = 30 }: { delay?: number; cps?: number } = {},
) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      el.textContent = text;
      return;
    }

    el.textContent = "";
    const state = { n: 0 };
    const tween = gsap.to(state, {
      n: text.length,
      duration: text.length / cps,
      delay,
      ease: "none",
      onUpdate: () => {
        el.textContent = text.slice(0, Math.round(state.n));
      },
      onComplete: () => {
        el.textContent = text;
      },
    });

    return () => {
      tween.kill();
    };
  }, [text, delay, cps]);

  return ref;
}

/**
 * Cross-dissolves whatever `src` addresses.
 *
 * Returns the outgoing source to render underneath and a ref for the incoming
 * layer, which is faded up over it. Used for both the backdrop photograph and
 * the M mark, so a backdrop change re-hues the whole pass as one move rather
 * than cutting in pieces.
 */
export function useCrossfade<T extends HTMLElement>(
  src: string,
  duration = 0.6,
  enabled = true,
) {
  const previous = useRef(src);
  const topRef = useRef<T | null>(null);
  const [under, setUnder] = useState<string | null>(null);

  useLayoutEffect(() => {
    // Read before overwriting: what goes underneath is the source being left
    // behind, not the one arriving. Rendering the incoming source on both
    // layers would fade an image up over a copy of itself — a dissolve with
    // nothing to dissolve.
    const outgoing = previous.current;
    if (outgoing === src) return;
    previous.current = src;
    // Disabled where the whole card is already being swapped — the landing
    // reel slides one pass out and another in, and dissolving the backdrop
    // underneath that would land the new pass on the old backdrop.
    //
    // Reduced motion bails here rather than in the tween effect below: there
    // is nothing to animate, and setting `under` only to clear it on the next
    // commit is a cascading render for no visible result.
    if (!enabled || prefersReducedMotion()) return;
    setUnder(outgoing);
  }, [src, enabled]);

  useLayoutEffect(() => {
    const el = topRef.current;
    if (!under || !el) return;

    const tween = gsap.fromTo(
      el,
      { opacity: 0 },
      {
        opacity: 1,
        duration,
        ease: "power2.inOut",
        onComplete: () => setUnder(null),
      },
    );
    return () => {
      tween.kill();
    };
  }, [under, src, duration]);

  return { under, topRef };
}

/**
 * Tweens the pass's ink from one theme to the next.
 *
 * The theme is a bag of CSS custom properties, and GSAP cannot interpolate a
 * custom property directly — so this tweens a scalar and writes every property
 * on each frame, interpolating the colours by hand.
 */
export function useThemeTransition(
  vars: Record<string, string>,
  duration = 0.6,
  enabled = true,
) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(vars);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const apply = (v: Record<string, string>) => {
      for (const key in v) el.style.setProperty(key, v[key]);
    };

    const from = previous.current;
    previous.current = vars;

    if (from === vars || !enabled || prefersReducedMotion()) {
      apply(vars);
      return;
    }

    const p = { t: 0 };
    const tween = gsap.to(p, {
      t: 1,
      duration,
      ease: "power2.inOut",
      onUpdate: () => {
        for (const key in vars) {
          el.style.setProperty(
            key,
            gsap.utils.interpolate(from[key], vars[key], p.t) as string,
          );
        }
      },
      onComplete: () => apply(vars),
    });

    return () => {
      tween.kill();
    };
  }, [vars, duration, enabled]);

  return ref;
}

/**
 * Settles every running tween before a capture.
 *
 * Without this, downloading mid-dissolve would rasterize a half-faded backdrop.
 * Long tweens are left alone so nothing pathological gets fast-forwarded.
 */
export function settleAnimations() {
  for (const tween of gsap.globalTimeline.getChildren(true, true, false)) {
    if (tween.totalDuration() < 5) tween.progress(1);
  }
}

/**
 * Flies the control panel's sections in from the right edge of the viewport.
 *
 * Each section starts with its own left edge parked at the window's right edge
 * rather than at a fixed offset, so they all travel in from the same line no
 * matter how wide they are.
 */
export function usePanelEntrance(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !enabled || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.from("[data-panel-item]", {
        x: (_i: number, el: Element) =>
          window.innerWidth - el.getBoundingClientRect().left,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.07,
        // Hand the elements back to CSS once they land, so nothing inside them
        // is stuck inside a transform that would break the sticky preview.
        clearProps: "transform,opacity",
      });
    }, root);

    return () => ctx.revert();
  }, [enabled]);

  return ref;
}
