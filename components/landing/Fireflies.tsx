"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Ambient fireflies for dark sections. A single canvas draws a handful of
 * soft glowing dots that wander on lazy sine paths and pulse in/out at their
 * own rhythm. Mount inside a `position: relative` section; it fills the host,
 * ignores the pointer, only animates while on screen, and renders a static
 * frame under `prefers-reduced-motion`.
 */

interface Fly {
  x: number;
  y: number;
  // Base drift + two sine wobbles so paths never look like straight lines
  vx: number;
  vy: number;
  w1: number;
  w2: number;
  ph1: number;
  ph2: number;
  r: number;
  // Blink: each fly has its own period + phase; `duty` shapes how long it stays lit
  period: number;
  blink: number;
  duty: number;
  hue: number;
}

const COLORS: [number, number, number][] = [
  [232, 211, 90], // meadow yellow
  [201, 224, 122], // lime
  [239, 233, 212], // cream
];

export function Fireflies({
  count = 36,
  stackPause,
}: {
  count?: number;
  stackPause?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const host: HTMLElement | null =
      canvas.closest("section") ?? canvas.parentElement;
    if (!host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let flies: Fly[] = [];

    const seed = () => {
      flies = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.5) * 10,
        w1: 0.25 + Math.random() * 0.4,
        w2: 0.12 + Math.random() * 0.25,
        ph1: Math.random() * Math.PI * 2,
        ph2: Math.random() * Math.PI * 2,
        r: 1.6 + Math.random() * 1.8,
        period: 2.2 + Math.random() * 3.5,
        blink: Math.random() * 6,
        duty: 0.35 + Math.random() * 0.3,
        hue: Math.floor(Math.random() * COLORS.length),
      }));
    };

    const resize = () => {
      const r = host.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!flies.length) seed();
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const f of flies) {
        // Smooth on/off pulse: raised-cosine window over `duty` of the period
        const p = ((t + f.blink) % f.period) / f.period;
        const lit =
          p < f.duty ? 0.5 - 0.5 * Math.cos((p / f.duty) * Math.PI * 2) : 0;
        if (lit < 0.02) continue;
        const [r, g, b] = COLORS[f.hue];
        const glow = f.r * 9;
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, glow);
        grad.addColorStop(0, `rgba(${r},${g},${b},${0.95 * lit})`);
        grad.addColorStop(0.18, `rgba(${r},${g},${b},${0.45 * lit})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(f.x, f.y, glow, 0, Math.PI * 2);
        ctx.fill();
        // Hot core
        ctx.fillStyle = `rgba(255,255,240,${0.9 * lit})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const step = (dt: number, t: number) => {
      for (const f of flies) {
        f.x +=
          (f.vx +
            Math.sin(t * f.w1 + f.ph1) * 18 +
            Math.sin(t * f.w2 + f.ph2) * 9) *
          dt;
        f.y +=
          (f.vy +
            Math.cos(t * f.w1 * 0.8 + f.ph2) * 14 +
            Math.sin(t * f.w2 + f.ph1) * 7) *
          dt;
        // Wrap with a margin so glows don't pop at the edge
        const m = 40;
        if (f.x < -m) f.x = w + m;
        else if (f.x > w + m) f.x = -m;
        if (f.y < -m) f.y = h + m;
        else if (f.y > h + m) f.y = -m;
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    if (reduced) {
      // One calm frame, no motion
      draw(1.3);
      return () => ro.disconnect();
    }

    let raf = 0;
    let last = 0;
    let visible = false;
    const loop = (now: number) => {
      if (!visible) return;
      const t = now / 1000;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      step(dt, t);
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    // Observe the canvas rather than the host: StackedPages hides buried
    // sheets with display:none on [data-stack-pause] nodes, which reads as
    // "not intersecting" here and stops the loop along with offscreen scroll.
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) {
        last = 0;
        raf = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(raf);
      }
    });
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, [count, reduced]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      {...(stackPause ? { "data-stack-pause": true } : {})}
      className="pointer-events-none absolute inset-0"
    />
  );
}
