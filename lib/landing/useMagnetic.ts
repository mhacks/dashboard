"use client";

import { useEffect, useRef } from "react";
import { isTouchDevice, prefersReducedMotion } from "@/lib/utils";

interface Options {
  strength?: number;
  radius?: number;
}

export function useMagnetic<T extends HTMLElement>(opts: Options = {}) {
  const ref = useRef<T | null>(null);
  const { strength = 0.25, radius = 120 } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isTouchDevice() || prefersReducedMotion()) return;

    let raf = 0;
    let running = false;
    let target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    const tick = () => {
      current.x += (target.x - current.x) * 0.15;
      current.y += (target.y - current.y) * 0.15;
      el.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;

      // Sleep once the element has settled; pointer events wake the loop.
      if (
        Math.abs(target.x - current.x) < 0.05 &&
        Math.abs(target.y - current.y) < 0.05
      ) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < radius + Math.max(rect.width, rect.height) / 2) {
        target = { x: dx * strength, y: dy * strength };
      } else {
        target = { x: 0, y: 0 };
      }
      start();
    };

    const onLeave = () => {
      target = { x: 0, y: 0 };
      start();
    };

    window.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      el.style.transform = "";
    };
  }, [strength, radius]);

  return ref;
}
