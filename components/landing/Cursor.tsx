"use client";

import { useEffect, useRef } from "react";
import { isTouchDevice, prefersReducedMotion } from "@/lib/utils";

export function Cursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const ditherRef = useRef<HTMLDivElement | null>(null);
  const crosshairRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({
    visible: false,
    hovering: false,
    boxLabel: null as string | null,
  });

  useEffect(() => {
    if (isTouchDevice()) return;
    document.documentElement.classList.add("has-custom-cursor");
    return () => document.documentElement.classList.remove("has-custom-cursor");
  }, []);

  useEffect(() => {
    if (isTouchDevice()) return;
    if (prefersReducedMotion()) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    const dither = ditherRef.current;
    const crosshair = crosshairRef.current;
    const label = labelRef.current;
    if (!dot || !ring || !dither || !crosshair || !label) return;

    const applyPresentation = () => {
      const { visible, hovering, boxLabel } = stateRef.current;
      const inBox = boxLabel !== null;
      const showRing = visible && !hovering;
      const showDot = visible && !inBox && !hovering;

      ring.style.opacity = showRing ? "1" : "0";
      dot.style.opacity = showDot ? "1" : "0";

      ring.style.width = inBox ? "300px" : "34px";
      ring.style.height = inBox ? "400px" : "34px";
      ring.style.borderRadius = inBox ? "2px" : "999px";
      ring.style.border = `1px solid ${
        inBox ? "rgba(245,241,222,0.95)" : "rgba(58,74,38,0.55)"
      }`;
      ring.style.background = inBox
        ? "rgba(245,241,222,0.03)"
        : "rgba(239,233,212,0.06)";
      ring.style.mixBlendMode = inBox ? "normal" : "multiply";

      const backdrop = inBox
        ? "contrast(1.2) saturate(0.8) brightness(1.05)"
        : "none";
      dither.style.opacity = inBox ? "0.9" : "0";
      dither.style.backdropFilter = backdrop;
      dither.style.setProperty("-webkit-backdrop-filter", backdrop);
      crosshair.style.opacity = inBox ? "0.9" : "0";
      label.textContent = boxLabel ?? "You";
      label.style.opacity = inBox ? "1" : "0";
    };

    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const dotPos = { x: mouse.x, y: mouse.y };
    const ringPos = { x: mouse.x, y: mouse.y };

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      const el = e.target instanceof Element ? e.target : null;
      stateRef.current.visible =
        el?.closest("[data-cursor-zone]") !== null && el !== null;
      applyPresentation();
      start();
    };

    const onLeave = () => {
      stateRef.current.visible = false;
      applyPresentation();
    };

    const detectHover = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const interactive =
        el.closest(
          "a, button, [data-cursor='hover'], [role='button'], input, textarea, select",
        ) !== null;
      stateRef.current.hovering = interactive;
      const boxHost = el.closest<HTMLElement>("[data-cursor-box]");
      stateRef.current.boxLabel =
        !interactive && boxHost ? boxHost.dataset.cursorBox || null : null;
      applyPresentation();
    };

    let raf = 0;
    let running = false;
    const tick = () => {
      dotPos.x += (mouse.x - dotPos.x) * 0.55;
      dotPos.y += (mouse.y - dotPos.y) * 0.55;
      ringPos.x += (mouse.x - ringPos.x) * 0.18;
      ringPos.y += (mouse.y - ringPos.y) * 0.18;
      dot.style.transform = `translate3d(${dotPos.x}px, ${dotPos.y}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) translate(-50%, -50%)`;

      if (
        Math.abs(mouse.x - ringPos.x) < 0.1 &&
        Math.abs(mouse.y - ringPos.y) < 0.1
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

    applyPresentation();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", detectHover);
    document.addEventListener("mouseleave", onLeave);
    start();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", detectHover);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[9999] hidden md:block"
        style={{
          transition:
            "width 260ms var(--ease-soft), height 260ms var(--ease-soft), border-radius 260ms var(--ease-soft), border-color 260ms, background 260ms, opacity 260ms",
          width: 34,
          height: 34,
          borderRadius: "999px",
          border: "1px solid rgba(58,74,38,0.55)",
          background: "rgba(239,233,212,0.06)",
          mixBlendMode: "multiply",
          opacity: 0,
        }}
      >
        <div
          ref={ditherRef}
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            backgroundImage: [
              "radial-gradient(circle, rgba(239,233,212,0.6) 0.6px, transparent 0.6px)",
              "radial-gradient(circle, rgba(29,36,18,0.55) 0.6px, transparent 0.6px)",
            ].join(", "),
            backgroundSize: "3px 3px, 3px 3px",
            backgroundPosition: "0 0, 1.5px 1.5px",
            mixBlendMode: "overlay",
            opacity: 0,
            transition: "opacity 260ms var(--ease-soft)",
          }}
        />

        <div
          ref={crosshairRef}
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 14,
            height: 14,
            opacity: 0,
            transition: "opacity 200ms var(--ease-soft)",
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "50%",
              height: 1,
              marginTop: -0.5,
              background: "rgba(245,241,222,0.95)",
            }}
          />
          <span
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              width: 1,
              marginLeft: -0.5,
              background: "rgba(245,241,222,0.95)",
            }}
          />
        </div>

        <div
          ref={labelRef}
          style={{
            position: "absolute",
            bottom: "100%",
            left: -1,
            padding: "4px 8px 3px",
            background: "#F5F1DE",
            color: "#1D2412",
            fontFamily: "var(--font-instrument-sans), system-ui, sans-serif",
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1,
            whiteSpace: "nowrap",
            opacity: 0,
            transition: "opacity 200ms var(--ease-soft)",
          }}
        >
          You
        </div>
      </div>
      <div
        ref={dotRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[9999] hidden md:block"
        style={{
          transition:
            "width 200ms var(--ease-soft), height 200ms var(--ease-soft), background 200ms, opacity 200ms",
          width: 4,
          height: 4,
          borderRadius: "999px",
          background: "#3A4A26",
          opacity: 0,
        }}
      />
    </>
  );
}
