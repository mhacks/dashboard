"use client";

import { useEffect } from "react";
import { scrollToHash, subscribeScroll } from "@/lib/landing/scroll";
import { normalizeHash } from "@/lib/landing/nav";

/**
 * Turns the top-level sections into a stacked-pages scroll: each sheet
 * scrolls in normally, freezes once its last screenful is in view, and the
 * next sheet slides up over it — a page laid on top rather than a linear
 * scroll.
 *
 * Every stacking sheet must be at least one viewport tall (min-h-screen) so
 * that once it has slid into place it covers the previous sheet completely.
 *
 * How: every pinning sheet becomes `position: sticky` with
 * `top: viewport − height`. Sheets taller than the viewport scroll through
 * their content first and pin at their last screenful; shorter sheets pin as
 * soon as they're fully visible. The sections' existing ascending z-indexes
 * and opaque rounded-top backgrounds do the actual covering, so this adds no
 * layout change — only the pinning.
 *
 * Perf: pinned sheets stay in the viewport geometrically forever, so without
 * intervention the compositor keeps every sheet (plus its blurs, canvases,
 * and glass layers) resident on the GPU for the whole scroll — deep in the
 * page that exhausts texture memory and Chromium starts dropping surfaces
 * (flashing glass/nav/sections). So once a sheet is fully buried it's
 * flipped to `visibility: hidden` (evicted from compositing), and anything
 * inside it marked [data-stack-pause] is display-toggled so
 * IntersectionObserver-gated canvas loops actually stop. Visibility and canvas
 * pause/resume follow document scroll position (each sheet restores only once
 * you've scrolled back up into its zone), and updates are rAF-throttled and
 * driven by both native scroll and Lenis.
 */
export function StackedPages() {
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    const sheets = Array.from(main.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );
    if (sheets.length < 3) return;
    // The footer (last sheet) is a normal scroll reveal, not a page laid on
    // top — so it never pins, and neither does the sheet before it (that one
    // must scroll off naturally with the footer trailing it in flow).
    const pinned = sheets.slice(0, -2);

    // Sheets pin one corner radius above the viewport top, so their rounded
    // top corners sit offscreen and can't expose the sheet behind. (The
    // sections' negative top margins are larger than this, so no gap opens
    // above the next sheet either.)
    const CORNER = 48;

    const layout = () => {
      const vh = window.innerHeight;
      for (const el of pinned) {
        el.style.position = "sticky";
        el.style.top = `${Math.round(vh - el.offsetHeight) - CORNER}px`;
      }
    };

    // Pause markers per sheet, resolved once up front.
    const pauseMarks = pinned.map((el) =>
      Array.from(el.querySelectorAll<HTMLElement>("[data-stack-pause]")),
    );
    const pausedFlags = pinned.map(() => false);

    // Flow offset for a sheet — sticky rects lie; offsetTop chain doesn't.
    const flowTop = (el: HTMLElement) => {
      let top = 0;
      for (
        let n: HTMLElement | null = el;
        n;
        n = n.offsetParent as HTMLElement | null
      ) {
        top += n.offsetTop;
      }
      return top;
    };

    // Pause once we've scrolled past the handoff to the next sheet (minus the
    // corner overlap). Restore when we scroll back above that line — each
    // sheet wakes individually as you move up through the stack, not all at
    // once like the old -44px successor check, and not late enough to flash
    // empty space like the 85%-vh threshold did.
    const buryAt = (i: number) => flowTop(sheets[i + 1]) - CORNER;

    let ticking = false;

    const pauseSheet = (i: number) => {
      pausedFlags[i] = true;
      pinned[i].style.visibility = "hidden";
      pauseMarks[i].forEach((n) => (n.style.display = "none"));
    };

    const restoreSheet = (i: number) => {
      pausedFlags[i] = false;
      pinned[i].style.visibility = "";
      pauseMarks[i].forEach((n) => (n.style.display = ""));
    };

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      for (let i = 0; i < pinned.length; i++) {
        const threshold = buryAt(i);
        if (!pausedFlags[i] && y >= threshold) {
          pauseSheet(i);
        } else if (pausedFlags[i] && y < threshold) {
          restoreSheet(i);
        }
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    // Sheet heights move (accordion opens, images load) — re-pin when they do.
    const ro = new ResizeObserver(layout);
    pinned.forEach((el) => ro.observe(el));
    layout();
    onScroll();
    // Arriving with a #hash (e.g. /#about): the native anchor jump lands
    // wrong because pinned sheets report sticky rects, so re-target once the
    // sheets are pinned and re-sync nav state when the scroll settles.
    if (window.location.hash) {
      const hash = normalizeHash(window.location.hash);
      if (hash !== window.location.hash) history.replaceState(null, "", hash);
      requestAnimationFrame(() => scrollToHash(hash));
    }
    window.addEventListener("resize", layout);
    window.addEventListener("scroll", onScroll, { passive: true });
    const unsubLenis = subscribeScroll(onScroll);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", layout);
      window.removeEventListener("scroll", onScroll);
      unsubLenis();
      for (const el of pinned) {
        el.style.position = "";
        el.style.top = "";
        el.style.visibility = "";
      }
      pauseMarks.flat().forEach((n) => (n.style.display = ""));
    };
  }, []);

  return null;
}
