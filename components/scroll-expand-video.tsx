"use client";

import { useRef, useEffect, useState } from "react";
import VideoPlayer from "./video-player";

const WRAPPER_VH = 160;
const EARLY = 0.7;
const VH_START = 65;
const VH_PEAK = 50;
const VH_END = 28;

const ABS_BEFORE = VH_START - EARLY * (WRAPPER_VH - 100); // 23
const ABS_AFTER = VH_END + (1 - EARLY) * (WRAPPER_VH - 100); // 46

export default function ScrollExpandVideo() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(-2);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const update = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const scrollable = wrapperRef.current.offsetHeight - window.innerHeight;
      setProgress(-rect.top / scrollable + EARLY);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, [isMobile]);

  if (isMobile) {
    return (
      <div className="px-6 pb-12">
        <VideoPlayer />
      </div>
    );
  }

  const isActive = progress >= 0 && progress <= 1;

  const P0 = 0.35;
  const P1 = 0.65;
  const ep = isActive
    ? progress < P0
      ? progress / P0
      : progress > P1
        ? (1 - progress) / (1 - P1)
        : 1
    : 0;

  const topVh = isActive
    ? progress < P0
      ? VH_START + (VH_PEAK - VH_START) * (progress / P0)
      : progress > P1
        ? VH_PEAK + (VH_END - VH_PEAK) * ((progress - P1) / (1 - P1))
        : VH_PEAK
    : 0;

  const widthVw = 50 + ep * 25;
  const overlayOpacity = ep * 0.7;
  const absoluteTop = progress > 1 ? `${ABS_AFTER}vh` : `${ABS_BEFORE}vh`;

  return (
    <div
      ref={wrapperRef}
      className="relative w-full"
      style={{ height: `${WRAPPER_VH}vh` }}
    >
      {overlayOpacity > 0 && (
        <div
          className="fixed inset-0 bg-black pointer-events-none"
          style={{ opacity: overlayOpacity, zIndex: 20 }}
        />
      )}
      <div
        style={{
          position: isActive ? "fixed" : "absolute",
          top: isActive ? `${topVh}%` : absoluteTop,
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: `${widthVw}vw`,
          zIndex: 21,
        }}
      >
        <VideoPlayer />
      </div>
    </div>
  );
}
