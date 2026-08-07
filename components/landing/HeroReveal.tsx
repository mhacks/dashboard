"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type MotionValue } from "framer-motion";
import Image from "next/image";
import { cn, isTouchDevice, prefersReducedMotion } from "@/lib/utils";

interface HeroImageProps {
  src: string;
  alt?: string;
  className?: string;
  priority?: boolean;
  hidden?: boolean;
  quality?: number;
  sizes?: string;
  fetchPriority?: "high" | "low" | "auto";
  loading?: "eager" | "lazy";
  unoptimized?: boolean;
  onLoad?: () => void;
}

/**
 * Point next/image at the largest source and let the optimizer derive the
 * responsive set — this replaces a hand-rolled srcSet whose width descriptors
 * described the files' heights (these photos are portrait), so the 3840w
 * candidate was really 2876px wide.
 */
function HeroImage({
  src,
  alt = "",
  className,
  priority,
  hidden,
  quality = 40,
  sizes = "100vw",
  fetchPriority,
  loading,
  unoptimized,
  onLoad,
}: HeroImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      aria-hidden={hidden || !alt ? true : undefined}
      fill
      sizes={sizes}
      quality={quality}
      priority={priority}
      fetchPriority={fetchPriority}
      loading={loading}
      unoptimized={unoptimized}
      onLoad={onLoad}
      draggable={false}
      className={cn("object-cover object-[50%_58%]", className)}
    />
  );
}

interface Props {
  scale?: MotionValue<number>;
  y?: MotionValue<string>;
  src?: string;
  radius?: number;
  /** True while StackedPages has buried the hero — defers sharp load and pauses reveal. */
  paused?: boolean;
  tiltX?: MotionValue<number>;
  tiltY?: MotionValue<number>;
  shiftX?: MotionValue<number>;
  shiftY?: MotionValue<number>;
  tiltScale?: number;
}

const DOT_GRID = [
  "radial-gradient(circle, rgba(255,255,255,0.3) 0.5px, transparent 0.5px)",
  "radial-gradient(circle, rgba(255,255,255,0.16) 0.5px, transparent 0.5px)",
].join(", ");

const BLUR_SRC: Record<string, string> = {
  "/hero/hero-clean-3840.png": "/hero/hero-clean-blur.webp",
  "/hero/hero-flower.jpg": "/hero/hero-flower-blur.webp",
  "/hero/hero-cloud.jpg": "/hero/hero-cloud-blur.webp",
};

function blurPlateFor(src: string) {
  return BLUR_SRC[src] ?? src;
}

/**
 * Dark blurred meadow with a soft "flashlight" circle that reveals the sharp
 * photo under the cursor.
 *
 * Perf: blur is a static pre-rendered plate (no CSS filter:blur). The blur
 * layer only gets scroll parallax; 3D tilt applies to the sharp reveal window
 * so Skia never re-blurs on pointer movement. The reveal moves via transforms
 * only — cursor movement never repaints the blurred layer.
 */
export function HeroReveal({
  scale,
  y,
  src = "/hero/hero-clean-3840.png",
  radius = 280,
  paused = false,
  tiltX,
  tiltY,
  shiftX,
  shiftY,
  tiltScale = 1.06,
}: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [hasActivated, setHasActivated] = useState(false);
  const [blurLoadedSrc, setBlurLoadedSrc] = useState<string | null>(null);
  const blurSrc = blurPlateFor(src);
  const sharpReady = blurLoadedSrc === src;

  if (!paused && !hasActivated) {
    setHasActivated(true);
  }

  useEffect(() => {
    if (!hasActivated) return;
    const id = requestAnimationFrame(() => {
      const img = stageRef.current?.querySelector<HTMLImageElement>(
        "[data-hero-blur] img",
      );
      if (img?.complete) setBlurLoadedSrc(src);
    });
    return () => cancelAnimationFrame(id);
  }, [src, hasActivated]);

  const innerR = radius * 0.68;
  const outerR = radius * 1.55;
  const winSize = Math.ceil(outerR * 2);
  const half = winSize / 2;

  useEffect(() => {
    const stage = stageRef.current;
    const win = windowRef.current;
    const inner = innerRef.current;
    if (!stage || !win || !inner || paused) return;

    if (prefersReducedMotion() || isTouchDevice()) {
      win.style.display = "none";
      return;
    }

    let rafId = 0;
    let running = false;
    let inView = true;
    let hasPointer = false;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let targetO = 0;
    let currentO = 0;
    let pendingX = 0;
    let pendingY = 0;
    let hasPending = false;

    const sizeInner = () => {
      inner.style.width = `${stage.offsetWidth}px`;
      inner.style.height = `${stage.offsetHeight}px`;
    };

    const apply = () => {
      win.style.transform = `translate3d(${currentX - half}px, ${currentY - half}px, 0)`;
      inner.style.transform = `translate3d(${half - currentX}px, ${half - currentY}px, 0)`;
      win.style.opacity = currentO.toFixed(3);
    };

    const consumePointer = () => {
      if (!hasPending) return;
      hasPending = false;
      const r = stage.getBoundingClientRect();
      const sx = stage.offsetWidth / r.width;
      const sy = stage.offsetHeight / r.height;
      targetX = (pendingX - r.left) * sx;
      targetY = (pendingY - r.top) * sy;
      if (!hasPointer) {
        hasPointer = true;
        currentX = targetX;
        currentY = targetY;
      }
    };

    const loop = () => {
      consumePointer();
      currentX += (targetX - currentX) * 0.2;
      currentY += (targetY - currentY) * 0.2;
      currentO += (targetO - currentO) * 0.16;

      const settled =
        Math.abs(targetX - currentX) < 0.1 &&
        Math.abs(targetY - currentY) < 0.1 &&
        Math.abs(targetO - currentO) < 0.005;

      if (settled) {
        currentX = targetX;
        currentY = targetY;
        currentO = targetO;
        apply();
        running = false;
        return;
      }

      apply();
      rafId = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || !inView) return;
      running = true;
      rafId = requestAnimationFrame(loop);
    };

    const onMove = (e: MouseEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      hasPending = true;
      targetO = 1;
      start();
    };
    const onLeave = () => {
      targetO = 0;
      start();
    };
    const onEnter = () => {
      targetO = 1;
      start();
    };

    const resizeObserver = new ResizeObserver(sizeInner);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (!inView) {
        cancelAnimationFrame(rafId);
        running = false;
      } else {
        start();
      }
    });

    sizeInner();
    apply();
    resizeObserver.observe(stage);
    intersectionObserver.observe(stage);
    stage.addEventListener("mousemove", onMove);
    stage.addEventListener("mouseleave", onLeave);
    stage.addEventListener("mouseenter", onEnter);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      stage.removeEventListener("mousemove", onMove);
      stage.removeEventListener("mouseleave", onLeave);
      stage.removeEventListener("mouseenter", onEnter);
    };
  }, [half, paused]);

  const maskGradient = `radial-gradient(circle at center, #000 0px, #000 ${innerR}px, transparent ${outerR}px)`;
  const onBlurLoaded = () => setBlurLoadedSrc(src);

  return (
    <div className="absolute inset-0 z-0 bg-moss-900">
      {/* Pre-blurred plate — scroll parallax only, never 3D-tilted */}
      <motion.div
        style={{ scale, y }}
        className="absolute inset-0 overflow-hidden"
      >
        {hasActivated ? (
          <div className="absolute inset-0 isolate overflow-hidden">
            <div className="absolute -inset-[12%]">
              <AnimatePresence initial={false}>
                <motion.div
                  key={blurSrc}
                  data-hero-blur
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <HeroImage
                    src={blurSrc}
                    alt=""
                    hidden
                    priority
                    fetchPriority="high"
                    unoptimized
                    onLoad={onBlurLoaded}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: DOT_GRID,
                backgroundSize: "3px 3px, 3px 3px",
                backgroundPosition: "0 0, 1.5px 1.5px",
                mixBlendMode: "soft-light",
                opacity: 0.75,
              }}
            />

            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "rgba(18, 36, 48, 0.08)" }}
            />

            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(29,36,18,0.18) 0%, rgba(29,36,18,0.04) 38%, rgba(29,36,18,0.42) 100%)",
              }}
            />
          </div>
        ) : null}
      </motion.div>

      {/* Sharp reveal — 3D tilt + cursor flashlight */}
      <div ref={stageRef} className="absolute inset-0">
        <motion.div
          className="absolute inset-0 will-change-transform"
          style={{
            rotateX: tiltX,
            rotateY: tiltY,
            x: shiftX,
            y: shiftY,
            scale: tiltScale,
          }}
        >
          <div
            ref={windowRef}
            className="pointer-events-none absolute left-0 top-0 overflow-hidden will-change-transform"
            style={{
              width: winSize,
              height: winSize,
              opacity: 0,
              WebkitMaskImage: maskGradient,
              maskImage: maskGradient,
            }}
          >
            <div
              ref={innerRef}
              className="absolute left-0 top-0 will-change-transform"
            >
              {hasActivated && !paused && sharpReady ? (
                <AnimatePresence initial={false}>
                  <motion.div
                    key={src}
                    className="absolute inset-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    <HeroImage
                      src={src}
                      alt="MHacks hero backdrop"
                      loading="eager"
                      fetchPriority="low"
                      quality={40}
                      sizes="828px"
                    />
                  </motion.div>
                </AnimatePresence>
              ) : null}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
