"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * Mouse-reactive dot-grid background: a faint lattice of dots that swell and
 * brighten around the cursor as it moves over the host section. The cursor
 * position and influence ease frame-to-frame, so the swell trails the pointer
 * like a soft spotlight.
 *
 * Perf: canvas-drawn; the rAF loop runs only while the pointer is over the
 * host (plus a short ease-out settle), pauses offscreen via
 * IntersectionObserver, and reduced-motion gets a single static grid.
 */

const SPACING = 30; // px between dot centers
const BASE_R = 1.1; // resting dot radius
const MAX_R = 3.6; // radius at the cursor's center
const REACH = 180; // influence radius around the cursor
const BASE_A = 0.14; // resting alpha
const MAX_A = 0.75; // alpha at the cursor's center

export function DotGridReactive({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    const host: HTMLElement =
      canvas.closest("section") ?? canvas.parentElement ?? document.body;

    let dpr = 1;
    let w = 0;
    let h = 0;
    // Target and eased cursor position (canvas space) + influence strength.
    let tx = -9999;
    let ty = -9999;
    let cx = -9999;
    let cy = -9999;
    let strength = 0;
    let targetStrength = 0;
    let running = false;
    let inView = true;
    let rafId = 0;

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const reach2 = REACH * REACH;
      for (let y = SPACING / 2; y < h; y += SPACING) {
        for (let x = SPACING / 2; x < w; x += SPACING) {
          const dx = x - cx;
          const dy = y - cy;
          const d2 = dx * dx + dy * dy;
          let e = 0;
          if (d2 < reach2 && strength > 0.001) {
            const t = 1 - Math.sqrt(d2) / REACH;
            e = t * t * (3 - 2 * t) * strength; // smoothstep falloff
          }
          const r = BASE_R + (MAX_R - BASE_R) * e;
          ctx.fillStyle = `rgba(239, 233, 212, ${BASE_A + (MAX_A - BASE_A) * e})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const loop = () => {
      if (!inView || document.hidden) {
        running = false;
        return;
      }
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      strength += (targetStrength - strength) * 0.12;
      draw();
      // Sleep once the pointer has left and the swell has fully decayed.
      if (
        targetStrength === 0 &&
        strength < 0.005 &&
        Math.abs(tx - cx) < 0.5 &&
        Math.abs(ty - cy) < 0.5
      ) {
        strength = 0;
        draw();
        running = false;
        return;
      }
      rafId = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || reduced) return;
      running = true;
      rafId = requestAnimationFrame(loop);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      draw(); // repaint the resting grid (also the reduced-motion frame)
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      tx = e.clientX - rect.left;
      ty = e.clientY - rect.top;
      // Snap the eased position on the first entry so the swell doesn't
      // fly in from the previous exit point.
      if (targetStrength === 0) {
        cx = tx;
        cy = ty;
      }
      targetStrength = 1;
      start();
    };
    const onLeave = () => {
      targetStrength = 0;
      start(); // run the decay, then sleep
    };

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) start();
      else {
        cancelAnimationFrame(rafId);
        running = false;
      }
    });

    resize();
    observer.observe(canvas);
    window.addEventListener("resize", resize);
    if (!reduced) {
      host.addEventListener("mousemove", onMove);
      host.addEventListener("mouseleave", onLeave);
    }

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      host.removeEventListener("mousemove", onMove);
      host.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ""}`}
    />
  );
}
