"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export default function VideoSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.86, 1.04, 0.86]);
  const overlay = useTransform(scrollYProgress, [0.12, 0.5, 0.88], [0, 0.9, 0]);
  const shadow = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [
      "0 20px 50px -30px rgba(31,42,22,0.4)",
      "0 50px 120px -40px rgba(0,0,0,0.75)",
      "0 20px 50px -30px rgba(31,42,22,0.4)",
    ],
  );

  return (
    <>
      <motion.div
        aria-hidden
        style={{ opacity: overlay }}
        className="pointer-events-none fixed inset-0 z-30 bg-black"
      />

      <div ref={ref} className="relative z-40 mt-16 px-5 md:px-10">
        <motion.div style={{ scale }} className="mx-auto max-w-5xl">
          <motion.div
            style={{ boxShadow: shadow }}
            className="relative aspect-video overflow-hidden rounded-2xl border border-black/10 bg-black"
          >
            <video
              className="w-full h-full object-contain"
              controls
              playsInline
              src="https://d1vfxy18qt9x1k.cloudfront.net/MHacks%202025%20Recap%20Final%20Draft.mp4"
            />
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}
