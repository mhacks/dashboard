"use client";

import { useEffect } from "react";
import { scrollToHash } from "@/lib/landing/scroll";

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
 * IntersectionObserver-gated canvas loops actually stop. Both toggles are
 * rAF-throttled and use a wide hysteresis band, so they only ever fire while
 * the sheet is deeply occluded — never visible, never thrashing.
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

    // A sheet is fully occluded once its successor's rounded corners have
    // cleared the top edge (top <= -CORNER). Pinned successors rest at
    // exactly -CORNER, so the thresholds sit a couple of pixels inside that:
    // evict at -46, restore at -44. The 2px hysteresis band only ever spans
    // corner slivers a few pixels wide, so a flip can never flash content.
    const PAUSE_AT = 2 - CORNER;
    const RESUME_AT = 4 - CORNER;

    let ticking = false;
    const update = () => {
      ticking = false;
      for (let i = 0; i < pinned.length; i++) {
        const top = sheets[i + 1].getBoundingClientRect().top;
        const el = pinned[i];
        if (!pausedFlags[i] && top <= PAUSE_AT) {
          pausedFlags[i] = true;
          el.style.visibility = "hidden";
          pauseMarks[i].forEach((n) => (n.style.display = "none"));
        } else if (pausedFlags[i] && top >= RESUME_AT) {
          pausedFlags[i] = false;
          el.style.visibility = "";
          pauseMarks[i].forEach((n) => (n.style.display = ""));
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
    // Arriving with a #hash (e.g. footer links on /how-to-mcp): the native
    // anchor jump lands wrong because pinned sheets report sticky rects, so
    // re-target once the sheets are pinned.
    if (window.location.hash) {
      const hash = window.location.hash;
      requestAnimationFrame(() => scrollToHash(hash));
    }
    window.addEventListener("resize", layout);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", layout);
      window.removeEventListener("scroll", onScroll);
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
