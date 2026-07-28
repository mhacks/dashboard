"use client";

import { motion } from "framer-motion";
import { asset } from "@/lib/landing/asset";

const IMAGES = [
  asset("/about/about-01.jpg"),
  asset("/about/about-02.jpg"),
  asset("/about/about-03.jpg"),
  asset("/about/about-04.jpg"),
  asset("/about/about-05.jpg"),
  asset("/about/about-06.jpg"),
  asset("/about/about-07.jpg"),
  asset("/about/about-08.jpg"),
];

interface Props {
  images?: string[];
  className?: string;
}

/**
 * Continuous right-to-left photo marquee. The strip is rendered twice and
 * translated by half its width on a linear loop, so it scrolls seamlessly.
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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt={`MHacks photo ${i + 1}`}
                loading="lazy"
                draggable={false}
                className="h-[200px] md:h-[240px] aspect-[3/2] rounded-md border border-border object-cover select-none"
              />
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
