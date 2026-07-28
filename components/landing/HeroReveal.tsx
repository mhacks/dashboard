"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, type MotionValue } from "framer-motion";
import { cn, isTouchDevice, prefersReducedMotion } from "@/lib/utils";
import { asset } from "@/lib/landing/asset";

interface HeroImageProps {
  src: string;
  src768?: string;
  src2560?: string;
  src3840?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  hidden?: boolean;
}

function HeroImage({
  src,
  src768,
  src2560,
  src3840,
  alt = "",
  className,
  style,
  priority,
  hidden,
}: HeroImageProps) {
  const base = src768 ?? src;
  const hires = src2560 ?? src;
  const ultra = src3840 ?? src2560 ?? src;
  const srcSet = `${base} 768w, ${hires} 1920w, ${ultra} 3840w`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={hires}
      srcSet={srcSet}
      sizes="100vw"
      alt={alt}
      aria-hidden={hidden || !alt ? true : undefined}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      draggable={false}
      className={cn("h-full w-full object-cover object-[50%_58%]", className)}
      style={style}
    />
  );
}

interface Props {
  scale?: MotionValue<number>;
  y?: MotionValue<string>;
  src?: string;
  src768?: string;
  src2560?: string;
  src3840?: string;
  radius?: number;
  blurPx?: number;
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
  src = asset("/hero/hero-clean.png"),
  src768 = asset("/hero/hero-clean.png"),
  src2560 = asset("/hero/hero-clean-2560.png"),
  src3840 = asset("/hero/hero-clean-3840.png"),
  radius = 280,
}: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);

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

    const toLocal = (e: MouseEvent) => {
      // Map viewport coords into the stage's untransformed space so the
      // reveal stays under the cursor while the stage is scaled/tilted.
      const r = stage.getBoundingClientRect();
      const sx = stage.offsetWidth / r.width;
      const sy = stage.offsetHeight / r.height;
      return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
    };

    const onMove = (e: MouseEvent) => {
      const p = toLocal(e);
      targetX = p.x;
      targetY = p.y;
      if (!hasPointer) {
        // First entry: snap into place instead of sweeping across the stage.
        hasPointer = true;
        currentX = targetX;
        currentY = targetY;
      }
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

  const imageProps = { src, src768, src2560, src3840 };
  const maskGradient = `radial-gradient(circle at center, #000 0px, #000 ${innerR}px, transparent ${outerR}px)`;

  return (
    <motion.div
      ref={stageRef}
      style={{ scale, y }}
      className="absolute inset-0 z-0 bg-moss-900 will-change-transform"
    >
      {/* Dark blurred veil — painted once, never repaints on cursor moves */}
      <div className="absolute inset-0 isolate overflow-hidden">
        <div
          className="absolute -inset-[12%] [filter:blur(7px)_brightness(0.84)_saturate(1.1)] md:[filter:blur(22px)_brightness(0.82)_saturate(1.12)_contrast(1.04)]"
          style={{ transform: "translateZ(0)" }}
        >
          {/* Crossfade between backdrop variants: the outgoing image stays
              mounted and fades under the incoming one */}
          <AnimatePresence initial={false}>
            <motion.div
              key={src}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <HeroImage {...imageProps} alt="" hidden />
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
          <AnimatePresence initial={false}>
            <motion.div
              key={src}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <HeroImage {...imageProps} alt="MHacks hero backdrop" priority />
            </motion.div>
          </AnimatePresence>
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
