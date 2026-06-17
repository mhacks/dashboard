"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Play } from "lucide-react";

export default function VideoSpotlight() {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

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

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setPlaying(true);
    }
  };

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
            className="group relative aspect-video overflow-hidden rounded-2xl border border-black/10 bg-black"
          >
            <video
              ref={videoRef}
              src="/MHacks 2025 Recap Final Draft.mp4"
              className="w-full h-full object-cover"
              controls={playing}
              playsInline
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />

            {!playing && (
              <div
                className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/25"
                onClick={handlePlay}
              >
                <div className="rounded-full bg-white/20 backdrop-blur-sm p-5 border border-white/30 transition-transform hover:scale-110">
                  <Play size={28} className="text-white fill-white" />
                </div>
              </div>
            )}

            {!playing && (
              <div className="absolute bottom-5 left-6 pointer-events-none">
                <p className="text-white text-[11px] font-light tracking-[0.35em] uppercase">
                  MHacks 2025&nbsp;·&nbsp;Recap
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}
