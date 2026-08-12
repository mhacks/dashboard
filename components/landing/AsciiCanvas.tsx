"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/utils";

interface Props {
  className?: string;
  color?: string;
  chars?: string[];
  step?: number;
  interactive?: boolean;
  fontSize?: number;
  opacity?: number;
  blendMode?: React.CSSProperties["mixBlendMode"];
  /** Mark for StackedPages so the loop stops once the host sheet is buried. */
  stackPause?: boolean;
}

/**
 * Ambient character field. Ports the interactive dot/char overlay from the
 * original index.html prototype into a React canvas that reacts to the cursor.
 */
export function AsciiCanvas({
  className,
  color = "245,241,222", // parchment
  chars = [".", ":", "·", "+", "x", "o", "*", "M", "H"],
  step = 14,
  interactive = true,
  fontSize = 11,
  opacity = 0.55,
  blendMode = "screen",
  stackPause,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const parent = c.parentElement;
    if (!parent) return;

    const reduced = prefersReducedMotion();
    let W = 0;
    let H = 0;
    let raf = 0;
    let running = false;
    let inView = true;
    const mouse = { x: -1e4, y: -1e4 };
    // The field is a pure function of the pointer position — no time term — so
    // a frame with an unmoved cursor would repaint identical pixels. Track what
    // the canvas currently shows and sleep as soon as it matches.
    let drawnX = NaN;
    let drawnY = NaN;

    interface Dot {
      x: number;
      y: number;
      ch: string;
      base: number;
    }
    let dots: Dot[] = [];

    const isActive = () =>
      inView && !document.hidden && c.offsetParent !== null;

    const build = () => {
      dots = [];
      for (let y = step; y < H; y += step) {
        for (let x = step; x < W; x += step) {
          if (Math.random() < 0.18) continue;
          dots.push({
            x: x + (Math.random() * 4 - 2),
            y: y + (Math.random() * 4 - 2),
            ch: chars[Math.floor(Math.random() * chars.length)],
            base: 0.15 + Math.random() * 0.25,
          });
        }
      }
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = parent.clientWidth;
      H = parent.clientHeight;
      // Polaroids are `hidden lg:block`, so a resize across that breakpoint
      // measures a collapsed parent. Bail rather than zero out the canvas.
      if (W === 0 || H === 0) return;
      c.width = Math.floor(W * dpr);
      c.height = Math.floor(H * dpr);
      c.style.width = `${W}px`;
      c.style.height = `${H}px`;
      // Resizing the backing store resets every context property, so the text
      // state has to be re-applied here rather than per frame.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontSize}px var(--font-red-hat-mono), ui-monospace, monospace`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      build();
      drawnX = NaN; // new dot field — force a repaint
      if (reduced) draw();
      else start();
    };

    const REACH = 180;
    const REACH2 = REACH * REACH;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      // One colour parse per frame instead of one per glyph: alpha rides on
      // globalAlpha, which composites identically to baking it into rgba().
      ctx.fillStyle = `rgb(${color})`;
      for (const d of dots) {
        let a = d.base;
        let ox = 0;
        let oy = 0;
        if (interactive && !reduced) {
          const dx = d.x - mouse.x;
          const dy = d.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          // Beyond REACH the falloff clamps to zero, so skip the sqrt entirely.
          if (d2 < REACH2) {
            const near = 1 - Math.sqrt(d2) / REACH;
            a = Math.min(1, d.base + near * 0.9);
            ox = dx * near * 0.06;
            oy = dy * near * 0.06;
          }
        }
        ctx.globalAlpha = a;
        ctx.fillText(d.ch, d.x + ox, d.y + oy);
      }
      ctx.globalAlpha = 1;
    };

    const tick = () => {
      if (!isActive()) {
        running = false;
        return;
      }
      // Nothing moved since the last paint — the next frame would be a pixel
      // copy of what's already on screen. Sleep; onMove/onLeave will wake us.
      if (mouse.x === drawnX && mouse.y === drawnY) {
        running = false;
        return;
      }
      drawnX = mouse.x;
      drawnY = mouse.y;
      draw();
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running || reduced) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      start();
    };
    const onLeave = () => {
      mouse.x = -1e4;
      mouse.y = -1e4;
      start(); // repaint the resting field, then sleep again
    };

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) {
        if (c.width === 0 || c.height === 0) resize();
        start();
      } else {
        cancelAnimationFrame(raf);
        running = false;
      }
    });

    const onVisibility = () => {
      if (!document.hidden) start();
    };

    resize();
    start();
    observer.observe(c);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    if (interactive) {
      parent.addEventListener("mousemove", onMove);
      parent.addEventListener("mouseleave", onLeave);
    }

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (interactive) {
        parent.removeEventListener("mousemove", onMove);
        parent.removeEventListener("mouseleave", onLeave);
      }
    };
  }, [chars, color, step, interactive, fontSize]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      {...(stackPause ? { "data-stack-pause": true } : {})}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        mixBlendMode: blendMode,
        opacity,
      }}
    />
  );
}
