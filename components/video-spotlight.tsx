"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { Play } from "lucide-react";

export default function VideoSpotlight() {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [playing, setPlaying] = useState(false);
  const [videoSize, setVideoSize] = useState({
    width: 1920,
    height: 1080,
  });

  const inView = useInView(ref, {
    amount: 0.45,
    once: false,
  });

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.86, 1.04, 0.86]);

  const overlay = useTransform(
    scrollYProgress,
    [0.12, 0.5, 0.88],
    [0, 0.9, 0],
  );

  const shadow = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [
      "0 20px 50px -30px rgba(31,42,22,0.4)",
      "0 50px 120px -40px rgba(0,0,0,0.75)",
      "0 20px 50px -30px rgba(31,42,22,0.4)",
    ],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (inView) {
      video
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      video.pause();
      setPlaying(false);
    }
  }, [inView]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    console.log("video size:", video.videoWidth, video.videoHeight);

    if (video.videoWidth && video.videoHeight) {
      setVideoSize({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    }
  };

  const handleManualPlay = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;

    video
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  };

  return (
    <>
      <motion.div
        aria-hidden
        style={{ opacity: overlay }}
        className="pointer-events-none fixed inset-0 z-30 bg-black"
      />

      <div ref={ref} className="relative z-40 mt-16 px-5 md:px-10">
        <motion.div style={{ scale }} className="mx-auto w-full max-w-5xl">
          <motion.div
            style={{
              boxShadow: shadow,
              aspectRatio: `${videoSize.width} / ${videoSize.height}`,
            }}
            className="relative w-full overflow-hidden rounded-2xl border border-black/10 bg-black"
          >
            <video
              ref={videoRef}
              src="/MHacks 2025 Recap Final Draft.mp4"
              width={videoSize.width}
              height={videoSize.height}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              loop
              playsInline
              preload="metadata"
              controls={playing}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />

            {!playing && (
              <button
                type="button"
                aria-label="Play MHacks recap video"
                onClick={handleManualPlay}
                className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/25"
              >
                <span className="rounded-full border border-white/30 bg-white/20 p-5 backdrop-blur-sm transition-transform hover:scale-110">
                  <Play size={28} className="fill-white text-white" />
                </span>
              </button>
            )}

            {!playing && (
              <div className="pointer-events-none absolute bottom-5 left-6">
                <p className="font-red-hat text-[11px] font-light uppercase tracking-[0.35em] text-white">
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