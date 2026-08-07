"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/* Raw public paths, not asset(): next/image builds its own /_next/image URLs
   and Next's basePath already rewrites those, unlike bare <img>/CSS URLs. */
const IMAGES = [
  "/about/about-01.jpg",
  "/about/about-02.jpg",
  "/about/about-03.jpg",
  "/about/about-04.jpg",
  "/about/about-05.jpg",
  "/about/about-06.jpg",
  "/about/about-07.jpg",
  "/about/about-08.jpg",
];

interface Props {
  images?: string[];
  className?: string;
  /** StackedPages burial — stops the marquee loop. */
  paused?: boolean;
}

/**
 * Continuous right-to-left photo marquee. The strip is rendered twice and
 * translated by half its width on a linear loop, so it scrolls seamlessly.
 *
 * The slot is a fixed 300x200 (360x240 at md), so `sizes` pins the candidate
 * width instead of letting the browser assume full-viewport — the sources are
 * 1600px wide originals and would otherwise be served far larger than the
 * frame they land in. Quality is kept low — motion hides compression artifacts.
 * Only viewport width + two buffer slots are mounted so the loop does not fetch
 * every photo up front.
 */
const GAP_PX = 20; // gap-5
const MOBILE_IMAGE_WIDTH = 300;
const DESKTOP_IMAGE_WIDTH = 360;
const DESKTOP_BREAKPOINT = 768;
const BUFFER_IMAGES = 2;

function slotWidthForViewport(viewportWidth: number) {
  const imageWidth =
    viewportWidth >= DESKTOP_BREAKPOINT
      ? DESKTOP_IMAGE_WIDTH
      : MOBILE_IMAGE_WIDTH;
  return imageWidth + GAP_PX;
}

function visibleImageCount(containerWidth: number) {
  const slots = Math.ceil(
    containerWidth / slotWidthForViewport(containerWidth),
  );
  return Math.min(Math.max(slots + BUFFER_IMAGES, 1), IMAGES.length);
}

export function ImageCarousel({
  images = IMAGES,
  className,
  paused = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep the initial count SSR-stable; ResizeObserver below syncs to the real
  // container width after hydration.
  const [visibleCount, setVisibleCount] = useState(() =>
    visibleImageCount(MOBILE_IMAGE_WIDTH),
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const update = () => {
      setVisibleCount(visibleImageCount(node.clientWidth));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const visibleImages = images.slice(0, visibleCount);

  return (
    <div ref={containerRef} className={`overflow-hidden ${className ?? ""}`}>
      <motion.div
        className="flex w-max gap-5"
        animate={paused ? false : { x: ["0%", "-50%"] }}
        transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex gap-5" aria-hidden={copy === 1}>
            {visibleImages.map((src, i) => (
              <Image
                key={`${copy}-${i}`}
                src={src}
                alt={`MHacks photo ${i + 1}`}
                width={360}
                height={240}
                sizes="(min-width: 768px) 360px, 300px"
                quality={40}
                draggable={false}
                /* w-auto is load-bearing: the width attribute lands as a CSS
                   presentational hint, which would pin the frame to 360px and
                   break the 300px mobile size that aspect-[3/2] derives. */
                className="h-[200px] md:h-[240px] w-auto aspect-[3/2] rounded-md border border-border object-cover select-none"
              />
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
