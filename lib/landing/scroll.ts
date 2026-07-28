import type Lenis from "lenis";

let lenis: Lenis | null = null;

/** Called by SmoothScroll so anchor navigation can drive the Lenis instance. */
export function registerLenis(instance: Lenis | null) {
  lenis = instance;
}

/** Animated scroll to an in-page anchor (e.g. "#about"). */
export function scrollToHash(hash: string) {
  const el = document.querySelector<HTMLElement>(hash);
  if (!el) return;

  // Sections are sticky-pinned sheets, so their bounding rects (which Lenis
  // uses for element targets) report the pinned position, not where they
  // live in the document — walk the offsetParent chain for the flow position.
  let top = 0;
  for (
    let n: HTMLElement | null = el;
    n;
    n = n.offsetParent as HTMLElement | null
  ) {
    top += n.offsetTop;
  }

  if (lenis) {
    lenis.scrollTo(top, {
      duration: 1.6,
      easing: (t) => 1 - Math.pow(1 - t, 4),
    });
    return;
  }
  // No Lenis (reduced motion): jump without animation.
  window.scrollTo({ top });
}
