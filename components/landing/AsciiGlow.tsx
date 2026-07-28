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
const CELL = 22; // px between glyph centers
const DENSITY = 0.34; // fraction of cells that hold a glyph
const FRAME_MS = 1000 / 24;

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
        size: star ? 18 + Math.random() * 14 : 12 + Math.random() * 6,
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
    let running = false;
    let inView = true;
    let lastFrame = 0;
    let dpr = 1;

    const draw = (timeSec: number) => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      let currentSize = 0;
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
        const color = g.accent
          ? `rgba(232, 211, 90, ${alpha})`
          : `rgba(239, 233, 212, ${alpha})`;
        // Soft halo once a star flares past half brightness.
        if (g.star && alpha > 0.25) {
          ctx.shadowColor = g.accent
            ? "rgba(232, 211, 90, 0.9)"
            : "rgba(239, 233, 212, 0.9)";
          ctx.shadowBlur = g.size * 0.7 * alpha;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = color;
        ctx.fillText(g.char, g.x, g.y);
      }
      ctx.shadowBlur = 0;
    };

    const loop = (now: number) => {
      if (!inView || document.hidden) {
        running = false;
        return;
      }
      if (now - lastFrame >= FRAME_MS) {
        lastFrame = now;
        draw(now / 1000);
      }
      const wait = Math.max(4, FRAME_MS - (performance.now() - lastFrame));
      timeoutId = window.setTimeout(() => {
        rafId = requestAnimationFrame(loop);
      }, wait);
    };

    const start = () => {
      if (running || reduced) return;
      running = true;
      lastFrame = 0;
      rafId = requestAnimationFrame(loop);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      glyphs = buildField(rect.width, rect.height, cell, density);
      if (reduced) draw(1.2); // single static frame
    };

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) start();
      else {
        cancelAnimationFrame(rafId);
        clearTimeout(timeoutId);
        running = false;
      }
    });

    const onVisibility = () => {
      if (!document.hidden) start();
    };

    resize();
    start();
    observer.observe(canvas);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      observer.disconnect();
      window.removeEventListener("resize", resize);
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
