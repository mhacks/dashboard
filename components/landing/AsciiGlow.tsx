"use client";

import { useEffect, useRef } from "react";
import { subscribeScroll } from "@/lib/landing/scroll";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * A starfield of ASCII glyphs over the hero — a galaxy night sky. Lots of
 * small faint "stars" with rarer, larger ones; each twinkles on its own slow
 * sine wave. Canvas-rendered at ~8fps (no shadowBlur halos — those were the
 * main perf cost). Loop pauses while scrolling, offscreen, or tab hidden.
 */

const SMALL_GLYPHS = "·.,:˙'`°";
const STAR_GLYPHS = "+*×✽✦✧";
const ACCENT_RGB = "rgb(232, 211, 90)";
const DUST_RGB = "rgb(239, 233, 212)";
const CELL = 22; // px between glyph centers
const DENSITY = 0.34; // fraction of cells that hold a glyph
const FRAME_MS = 1000 / 8;
/** Backing store vs CSS size — slightly softens glyphs, fewer pixels per frame. */
const RES_SCALE = 0.85;
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
    let logicalW = 0;
    let logicalH = 0;
    let clockOffset = 0;
    let pauseStart = 0;

    const canRun = () => inView && !scrolling && !document.hidden;

    const draw = (timeSec: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, logicalW, logicalH);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      let currentSize = 0;
      let currentFill = "";
      for (const g of glyphs) {
        const wave = 0.5 + 0.5 * Math.sin(timeSec * g.speed + g.phase);
        const alpha = g.peak * wave * wave * wave;
        if (alpha < 0.01) {
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
        const fill = g.accent ? ACCENT_RGB : DUST_RGB;
        if (fill !== currentFill) {
          currentFill = fill;
          ctx.fillStyle = fill;
        }
        ctx.globalAlpha = alpha;
        ctx.fillText(g.char, g.x, g.y);
      }
      ctx.globalAlpha = 1;
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
      if (rect.width === 0 || rect.height === 0) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      logicalW = rect.width * RES_SCALE;
      logicalH = rect.height * RES_SCALE;
      canvas.width = Math.round(logicalW * dpr);
      canvas.height = Math.round(logicalH * dpr);
      glyphs = buildField(logicalW, logicalH, cell, density);
      if (reduced) draw(1.2);
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
    const unsubLenis = subscribeScroll(onScroll);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      clearTimeout(scrollIdleId);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      unsubLenis();
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
