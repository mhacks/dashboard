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
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();

    let W = 0;
    let H = 0;
    const parent = c.parentElement!;
    const mouse = { x: -1e4, y: -1e4 };

    interface Dot {
      x: number;
      y: number;
      ch: string;
      base: number;
    }
    let dots: Dot[] = [];

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
      c.width = Math.floor(W * dpr);
      c.height = Math.floor(H * dpr);
      c.style.width = `${W}px`;
      c.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.font = `${fontSize}px var(--font-red-hat-mono), ui-monospace, monospace`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      for (const d of dots) {
        let a = d.base;
        let ox = 0;
        let oy = 0;
        if (interactive && !reduced) {
          const dx = d.x - mouse.x;
          const dy = d.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          const near = Math.max(0, 1 - dist / 180);
          a = Math.min(1, d.base + near * 0.9);
          ox = dx * near * 0.06;
          oy = dy * near * 0.06;
        }
        ctx.fillStyle = `rgba(${color}, ${a})`;
        ctx.fillText(d.ch, d.x + ox, d.y + oy);
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = -1e4;
      mouse.y = -1e4;
    };

    resize();
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    if (interactive) {
      parent.addEventListener("mousemove", onMove);
      parent.addEventListener("mouseleave", onLeave);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
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
