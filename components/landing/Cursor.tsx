"use client";

import { useEffect, useRef } from "react";
import { subscribeScroll } from "@/lib/landing/scroll";
import { isTouchDevice, prefersReducedMotion } from "@/lib/utils";

/** Last known pointer position — updated before React mounts the cursor. */
const lastPointer = { x: -1, y: -1 };

if (typeof window !== "undefined") {
  window.addEventListener(
    "pointermove",
    (e) => {
      lastPointer.x = e.clientX;
      lastPointer.y = e.clientY;
    },
    { capture: true, passive: true },
  );
}

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

    let heroBoxReady = false;
    let morphRaf = 0;

    const ringSize = () => ({
      w: ring.offsetWidth || 34,
      h: ring.offsetHeight || 34,
    });

    const applyRingTransform = () => {
      const { w, h } = ringSize();
      ring.style.transform = `translate3d(${ringPos.x - w / 2}px, ${ringPos.y - h / 2}px, 0)`;
    };

    const applyDotTransform = () => {
      dot.style.transform = `translate3d(${dotPos.x - 2}px, ${dotPos.y - 2}px, 0)`;
    };

    const pinRingDuringMorph = () => {
      cancelAnimationFrame(morphRaf);
      const start = performance.now();
      const step = () => {
        applyRingTransform();
        if (performance.now() - start < 280) {
          morphRaf = requestAnimationFrame(step);
        }
      };
      morphRaf = requestAnimationFrame(step);
    };

    const applyPresentation = () => {
      const { visible, hovering, boxLabel } = stateRef.current;
      const inBox = boxLabel !== null;
      const showRing = visible && !hovering;
      const showDot = visible && !inBox && !hovering;
      const wasInBox = ring.dataset.inBox === "1";

      ring.style.opacity = showRing ? "1" : "0";
      dot.style.opacity = showDot ? "1" : "0";

      ring.style.width = inBox ? "300px" : "34px";
      ring.style.height = inBox ? "400px" : "34px";
      ring.style.borderRadius = inBox ? "2px" : "999px";
      ring.dataset.inBox = inBox ? "1" : "0";
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

      applyRingTransform();
      if (inBox !== wasInBox) pinRingDuringMorph();
    };

    const mouse = {
      x: lastPointer.x >= 0 ? lastPointer.x : 0,
      y: lastPointer.y >= 0 ? lastPointer.y : 0,
    };
    const dotPos = { x: mouse.x, y: mouse.y };
    const ringPos = { x: mouse.x, y: mouse.y };
    let hasPointer = lastPointer.x >= 0;

    const snapTrailers = () => {
      dotPos.x = mouse.x;
      dotPos.y = mouse.y;
      ringPos.x = mouse.x;
      ringPos.y = mouse.y;
      applyRingTransform();
      applyDotTransform();
    };

    const syncFromElement = (el: Element | null) => {
      if (!el) {
        stateRef.current.visible = false;
        stateRef.current.hovering = false;
        stateRef.current.boxLabel = null;
        return;
      }
      const boxHost = el.closest<HTMLElement>("[data-cursor-box]");
      const boxReady =
        heroBoxReady ||
        (boxHost?.hasAttribute("data-cursor-box-ready") ?? false);

      // Hold the hero cursor until the title finishes typing.
      if (boxHost && !boxReady) {
        stateRef.current.visible = false;
        stateRef.current.hovering = false;
        stateRef.current.boxLabel = null;
        return;
      }

      stateRef.current.visible =
        el.closest("[data-cursor-zone]") !== null && el !== null;
      const interactive =
        el.closest(
          "a, button, [data-cursor='hover'], [role='button'], input, textarea, select",
        ) !== null;
      stateRef.current.hovering = interactive;
      stateRef.current.boxLabel =
        !interactive && boxHost && boxReady
          ? boxHost.dataset.cursorBox || null
          : null;
    };

    const onMove = (e: MouseEvent) => {
      hasPointer = true;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      const el = e.target instanceof Element ? e.target : null;
      const prevVisible = stateRef.current.visible;
      const prevBox = stateRef.current.boxLabel;
      syncFromElement(el);
      const waitingForHero =
        el?.closest("[data-cursor-box]") &&
        !heroBoxReady &&
        !el.closest("[data-cursor-box]")?.hasAttribute("data-cursor-box-ready");
      if (waitingForHero) {
        // Track position invisibly so the box can morph in at the cursor.
        snapTrailers();
        return;
      }
      const revealing =
        (stateRef.current.visible && !prevVisible) ||
        (stateRef.current.boxLabel && !prevBox);
      if (revealing) snapTrailers();
      applyPresentation();
      start();
    };

    const onLeave = () => {
      stateRef.current.visible = false;
      stateRef.current.boxLabel = null;
      applyPresentation();
    };

    let raf = 0;
    let running = false;

    const tick = () => {
      dotPos.x += (mouse.x - dotPos.x) * 0.55;
      dotPos.y += (mouse.y - dotPos.y) * 0.55;
      ringPos.x += (mouse.x - ringPos.x) * 0.18;
      ringPos.y += (mouse.y - ringPos.y) * 0.18;
      applyRingTransform();
      applyDotTransform();

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

    // mouseover doesn't fire when the pointer is already over the hero on load,
    // so derive zone/box state from the element under the cursor on mount too.
    const syncFromPoint = (x: number, y: number) => {
      mouse.x = x;
      mouse.y = y;
      syncFromElement(document.elementFromPoint(x, y));
      snapTrailers();
      applyPresentation();
      start();
    };

    const resyncAtPointer = () => {
      if (!hasPointer && lastPointer.x < 0) return;
      const x = hasPointer ? mouse.x : lastPointer.x;
      const y = hasPointer ? mouse.y : lastPointer.y;
      syncFromElement(document.elementFromPoint(x, y));
      applyPresentation();
    };

    // Lenis fires many scroll events per frame; batch zone checks to one
    // elementFromPoint read per frame so the cursor still hides when content
    // scrolls away under a stationary pointer.
    let scrollRafId = 0;
    let scrollIdleId = 0;
    const SCROLL_RESUME_MS = 150;

    const scheduleScrollResync = () => {
      if (scrollRafId) return;
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = 0;
        resyncAtPointer();
      });
    };

    const onScrollIdle = () => {
      resyncAtPointer();
    };

    const onScroll = () => {
      scheduleScrollResync();
      clearTimeout(scrollIdleId);
      scrollIdleId = window.setTimeout(onScrollIdle, SCROLL_RESUME_MS);
    };

    const onHeroCursorReady = () => {
      heroBoxReady = true;
      if (!hasPointer && lastPointer.x < 0) return;
      const x = hasPointer ? mouse.x : lastPointer.x;
      const y = hasPointer ? mouse.y : lastPointer.y;
      mouse.x = x;
      mouse.y = y;
      syncFromElement(document.elementFromPoint(x, y));
      snapTrailers();
      applyPresentation();
    };

    if (lastPointer.x >= 0) {
      syncFromPoint(lastPointer.x, lastPointer.y);
    } else {
      ring.style.transform = "translate3d(-9999px, -9999px, 0)";
      dot.style.transform = "translate3d(-9999px, -9999px, 0)";
      applyPresentation();
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mhacks:hero-cursor-ready", onHeroCursorReady);
    window.addEventListener("scroll", onScroll, { passive: true });
    const unsubScroll = subscribeScroll(onScroll);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(morphRaf);
      cancelAnimationFrame(scrollRafId);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mhacks:hero-cursor-ready", onHeroCursorReady);
      clearTimeout(scrollIdleId);
      window.removeEventListener("scroll", onScroll);
      unsubScroll();
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
          transform: "translate3d(-9999px, -9999px, 0)",
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
          transform: "translate3d(-9999px, -9999px, 0)",
        }}
      />
    </>
  );
}
