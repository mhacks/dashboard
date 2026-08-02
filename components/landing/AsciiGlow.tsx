"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * A starfield of ASCII glyphs over the hero — a galaxy night sky. Lots of
 * small faint "stars" with rarer, larger ones; each twinkles on its own slow
 * sine wave, flaring bright with a soft glow halo before dimming back out.
 * Canvas-rendered and capped to ~24fps; the loop pauses while the hero is
 * offscreen or the tab is hidden.
 */

const SMALL_GLYPHS = "·.,:˙'`°";
const STAR_GLYPHS = "+*×✽✦✧";
const ACCENT_RGB = "rgb(232, 211, 90)";
const DUST_RGB = "rgb(239, 233, 212)";
const CELL = 22; // px between glyph centers
const DENSITY = 0.34; // fraction of cells that hold a glyph
const FRAME_MS = 1000 / 24;
/** Quiet period after the last scroll event before the twinkle resumes. */
const SCROLL_RESUME_MS = 150;

interface Glyph {
  x: number;
  y: number;
  char: string;
  size: number; // font px
  phase: number;
  speed: number; // radians per second
  peak: number; // max alpha
  accent: boolean;
  star: boolean; // bigger feature star vs. background dust
}

function buildField(
  w: number,
  h: number,
  cell: number,
  density: number,
): Glyph[] {
  const glyphs: Glyph[] = [];
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() > density) continue;
      // Mostly small dust, ~1 in 4 are proper stars.
      const star = Math.random() < 0.28;
      const pool = star ? STAR_GLYPHS : SMALL_GLYPHS;
      glyphs.push({
        x: c * cell + cell / 2 + (Math.random() - 0.5) * cell * 0.8,
        y: r * cell + cell / 2 + (Math.random() - 0.5) * cell * 0.8,
        char: pool[Math.floor(Math.random() * pool.length)],
        // Whole pixels, so the sort below actually collapses into ~20 runs.
        // Fractional sizes made every glyph a distinct `ctx.font` string, and
        // each assignment re-parses the font — ~1500 parses per frame.
        size: star
          ? 18 + Math.round(Math.random() * 14)
          : 12 + Math.round(Math.random() * 6),
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 1.1,
        peak: star ? 0.45 + Math.random() * 0.5 : 0.2 + Math.random() * 0.35,
        accent: Math.random() < 0.14,
        star,
      });
    }
  }
  // Sorted by size so the per-glyph font assignment below rarely changes.
  return glyphs.sort((a, b) => a.size - b.size);
}

export function AsciiGlow({
  className,
  cell = CELL,
  density = DENSITY,
}: {
  className?: string;
  /** px between glyph centers — smaller = denser field */
  cell?: number;
  /** fraction of cells holding a glyph */
  density?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    let glyphs: Glyph[] = [];
    let rafId = 0;
    let timeoutId = 0;
    let scrollIdleId = 0;
    let running = false;
    let inView = true;
    let scrolling = false;
    let lastFrame = 0;
    let dpr = 1;
    // The twinkle is driven off wall-clock time. While the loop is parked we
    // bank the elapsed time here and subtract it, so the sky resumes from the
    // exact frame it froze on instead of jumping forward a second of phase.
    let clockOffset = 0;
    let pauseStart = 0;

    const canRun = () => inView && !scrolling && !document.hidden;

    const draw = (timeSec: number) => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      let currentSize = 0;
      let currentFill = "";
      let currentShadow = "";
      let currentAlpha = 1;
      let currentBlur = 0;
      for (const g of glyphs) {
        const wave = 0.5 + 0.5 * Math.sin(timeSec * g.speed + g.phase);
        // Sharpen the curve so glyphs spend most time dim, then flare up.
        const alpha = g.peak * wave * wave * wave;
        if (alpha < 0.01) {
          // Reincarnate while invisible so the sky keeps evolving.
          if (Math.random() < 0.02) {
            const pool = g.star ? STAR_GLYPHS : SMALL_GLYPHS;
            g.char = pool[Math.floor(Math.random() * pool.length)];
          }
          continue;
        }
        if (g.size !== currentSize) {
          currentSize = g.size;
          ctx.font = `${g.size}px var(--font-red-hat-mono), ui-monospace, monospace`;
        }
        // Soft halo once a star flares past half brightness.
        if (g.star && alpha > 0.25) {
          // The halo is deliberately independent of the glyph's own alpha, so
          // this path keeps the alpha baked into fillStyle — globalAlpha would
          // dim the shadow along with the glyph and change the look.
          if (currentAlpha !== 1) {
            currentAlpha = 1;
            ctx.globalAlpha = 1;
          }
          const shadow = g.accent
            ? "rgba(232, 211, 90, 0.9)"
            : "rgba(239, 233, 212, 0.9)";
          if (shadow !== currentShadow) {
            currentShadow = shadow;
            ctx.shadowColor = shadow;
          }
          currentBlur = g.size * 0.7 * alpha;
          ctx.shadowBlur = currentBlur;
          ctx.fillStyle = g.accent
            ? `rgba(232, 211, 90, ${alpha})`
            : `rgba(239, 233, 212, ${alpha})`;
          currentFill = "";
        } else {
          if (currentBlur !== 0) {
            currentBlur = 0;
            ctx.shadowBlur = 0;
          }
          // Flat glyphs: two constant colours + globalAlpha, which composites
          // identically to a per-glyph rgba() string but skips the parse.
          const fill = g.accent ? ACCENT_RGB : DUST_RGB;
          if (fill !== currentFill) {
            currentFill = fill;
            ctx.fillStyle = fill;
          }
          currentAlpha = alpha;
          ctx.globalAlpha = alpha;
        }
        ctx.fillText(g.char, g.x, g.y);
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    const loop = (now: number) => {
      if (!canRun()) {
        running = false;
        return;
      }
      if (now - lastFrame >= FRAME_MS) {
        lastFrame = now;
        draw((now - clockOffset) / 1000);
      }
      const wait = Math.max(4, FRAME_MS - (performance.now() - lastFrame));
      timeoutId = window.setTimeout(() => {
        rafId = requestAnimationFrame(loop);
      }, wait);
    };

    const start = () => {
      if (running || reduced || !canRun()) return;
      running = true;
      lastFrame = 0;
      rafId = requestAnimationFrame(loop);
    };

    const stop = () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      running = false;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      // StackedPages display-toggles this canvas while the hero is buried, and
      // a resize landing in that window would size the backing store to 0x0 —
      // which never recovers on its own, leaving the starfield permanently
      // blank. Skip while hidden; the observer re-measures on the way back in.
      if (rect.width === 0 || rect.height === 0) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      glyphs = buildField(rect.width, rect.height, cell, density);
      if (reduced) draw(1.2); // single static frame
    };

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) {
        if (canvas.width === 0 || canvas.height === 0) resize();
        start();
      } else stop();
    });

    const onVisibility = () => {
      if (!document.hidden) start();
    };

    /* Nobody can read a 24fps twinkle while the view is moving, and this loop
       is the hero's only measurable cost during a scroll (~31% of the
       main-thread work across the hero->about transition, almost all of it
       canvas shadowBlur on the star halos). So park it while scrolling and
       resume shortly after the scroll settles — the frozen frame stays on
       screen throughout, so the sky never blanks. */
    const onScroll = () => {
      if (!scrolling) {
        scrolling = true;
        pauseStart = performance.now();
        stop();
      }
      clearTimeout(scrollIdleId);
      scrollIdleId = window.setTimeout(() => {
        scrolling = false;
        clockOffset += performance.now() - pauseStart;
        start();
      }, SCROLL_RESUME_MS);
    };

    resize();
    start();
    observer.observe(canvas);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      clearTimeout(scrollIdleId);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [cell, density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ""}`}
    />
  );
}
