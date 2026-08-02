"use client";

import { motion } from "framer-motion";
import Image from "next/image";

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
}

/**
 * Continuous right-to-left photo marquee. The strip is rendered twice and
 * translated by half its width on a linear loop, so it scrolls seamlessly.
 *
 * The slot is a fixed 300x200 (360x240 at md), so `sizes` pins the candidate
 * width instead of letting the browser assume full-viewport — the sources are
 * 1600px wide originals and would otherwise be served far larger than the
 * frame they land in.
 */
export function ImageCarousel({ images = IMAGES, className }: Props) {
  return (
    <div className={`overflow-hidden ${className ?? ""}`}>
      <motion.div
        className="flex w-max gap-5"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex gap-5" aria-hidden={copy === 1}>
            {images.map((src, i) => (
              <Image
                key={src}
                src={src}
                alt={`MHacks photo ${i + 1}`}
                width={360}
                height={240}
                sizes="(min-width: 768px) 360px, 300px"
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
