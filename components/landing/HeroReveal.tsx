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
}

const DOT_GRID = [
  "radial-gradient(circle, rgba(255,255,255,0.3) 0.5px, transparent 0.5px)",
  "radial-gradient(circle, rgba(255,255,255,0.16) 0.5px, transparent 0.5px)",
].join(", ");

/**
 * Dark blurred meadow with a soft "flashlight" circle that reveals the sharp
 * photo under the cursor.
 *
 * Perf note: the reveal is a fixed-size masked window that moves with pure
 * transforms (window translates one way, the image inside counter-translates)
 * so cursor movement never repaints the blurred layer — everything stays on
 * the compositor. The mask itself is static.
 */
export function HeroReveal({
  scale,
  y,
  src = "/hero/hero-clean-3840.png",
  radius = 280,
}: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [blurLoadedSrc, setBlurLoadedSrc] = useState<string | null>(null);
  const sharpReady = blurLoadedSrc === src;

  useEffect(() => {
    // Cached blur plates can paint without firing onLoad — probe after mount.
    const id = requestAnimationFrame(() => {
      const img = stageRef.current?.querySelector("img");
      if (img?.complete) setBlurLoadedSrc(src);
    });
    return () => cancelAnimationFrame(id);
  }, [src]);

  // Feathered edge: fully sharp to innerR, fades out by outerR.
  const innerR = radius * 0.68;
  const outerR = radius * 1.55;
  const winSize = Math.ceil(outerR * 2);
  const half = winSize / 2;

  useEffect(() => {
    const stage = stageRef.current;
    const win = windowRef.current;
    const inner = innerRef.current;
    if (!stage || !win || !inner) return;

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
    // Latest pointer position in viewport coords, mapped to stage space once
    // per frame rather than per event — see consumePointer.
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

    // Map viewport coords into the stage's untransformed space so the reveal
    // stays under the cursor while the stage is scaled/tilted. This reads
    // layout, so it runs at most once per frame from inside the loop instead
    // of once per mousemove — high-polling-rate mice fire several times a
    // frame, and each read forced a synchronous layout while Lenis was
    // mid-transform. Only the last event before a frame ever mattered, so the
    // eased result is unchanged.
    const consumePointer = () => {
      if (!hasPending) return;
      hasPending = false;
      const r = stage.getBoundingClientRect();
      const sx = stage.offsetWidth / r.width;
      const sy = stage.offsetHeight / r.height;
      targetX = (pendingX - r.left) * sx;
      targetY = (pendingY - r.top) * sy;
      if (!hasPointer) {
        // First entry: snap into place instead of sweeping across the stage.
        hasPointer = true;
        currentX = targetX;
        currentY = targetY;
      }
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
  }, [half]);

  const imageProps = { src };
  const maskGradient = `radial-gradient(circle at center, #000 0px, #000 ${innerR}px, transparent ${outerR}px)`;

  const onBlurLoaded = () => setBlurLoadedSrc(src);

  return (
    <motion.div
      ref={stageRef}
      style={{ scale, y }}
      className="absolute inset-0 z-0 bg-moss-900 will-change-transform"
    >
      {/* Dark blurred veil — same src as sharp, but next/image serves a tiny
          AVIF/WebP slice (480px @ q40) via priority; full-res waits behind. */}
      <div className="absolute inset-0 isolate overflow-hidden">
        <div
          className="absolute -inset-[12%] [filter:blur(7px)_brightness(0.84)_saturate(1.1)] md:[filter:blur(22px)_brightness(0.82)_saturate(1.12)_contrast(1.04)]"
          style={{ transform: "translateZ(0)" }}
        >
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
                {...imageProps}
                alt=""
                hidden
                priority
                fetchPriority="high"
                quality={20}
                sizes="384px"
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
      </div>

      {/* Moving masked window revealing the sharp photo */}
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
          {sharpReady ? (
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
                  {...imageProps}
                  alt="MHacks hero backdrop"
                  fetchPriority="low"
                  quality={40}
                  sizes="828px"
                />
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      </div>

      {/* Film grain moved up to the Hero section: blended layers inside this
          transforming stage forced a re-composite every tilt/scroll frame. */}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(29,36,18,0.18) 0%, rgba(29,36,18,0.04) 38%, rgba(29,36,18,0.42) 100%)",
        }}
      />
    </motion.div>
  );
}
