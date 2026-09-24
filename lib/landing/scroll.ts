import type Lenis from "lenis";

let lenis: Lenis | null = null;
const scrollListeners = new Set<() => void>();

function emitScroll() {
  scrollListeners.forEach((listener) => listener());
}

/** Subscribe to scroll position changes (Lenis + native fallback). */
export function subscribeScroll(listener: () => void) {
  scrollListeners.add(listener);
  return () => scrollListeners.delete(listener);
}

/** Called by SmoothScroll so anchor navigation can drive the Lenis instance. */
export function registerLenis(instance: Lenis | null) {
  lenis?.off("scroll", emitScroll);
  lenis = instance;
  lenis?.on("scroll", emitScroll);
}

/** Animated scroll to an in-page anchor (e.g. "#about"). */
export function scrollToHash(hash: string) {
  const el = document.querySelector<HTMLElement>(hash);
  if (!el) return;

  // Sections are sticky-pinned sheets, so their bounding rects (which Lenis
  // uses for element targets) report the pinned position, not where they
  // live in the document — walk the offsetParent chain for the flow position.
  //
  // That alone isn't enough once `el` itself has already been scrolled past:
  // Chromium reports a *stuck* sticky element's own offsetTop near the
  // current scroll position rather than its static flow position, which
  // collapses the target distance to near-zero. Un-stick it for this one
  // synchronous read — nothing repaints mid-task, so there's no visible
  // flash — then restore it before yielding back to the browser.
  const prevPosition = el.style.position;
  el.style.position = "static";

  let top = 0;
  for (
    let n: HTMLElement | null = el;
    n;
    n = n.offsetParent as HTMLElement | null
  ) {
    top += n.offsetTop;
  }

  el.style.position = prevPosition;

  if (lenis) {
    const distance = Math.abs(window.scrollY - top);
    const vh = window.innerHeight || 1;
    // Scale with travel distance so deep links (e.g. logo → #top) don't run a
    // fixed 1.6s crawl; cap low so short hops still feel snappy.
    const duration = Math.min(1.05, Math.max(0.45, (distance / vh) * 0.32));
    lenis.scrollTo(top, {
      duration,
      easing: (t) => 1 - Math.pow(1 - t, 4),
    });
    return;
  }
  // No Lenis (reduced motion): jump without animation.
  window.scrollTo({ top });
}
