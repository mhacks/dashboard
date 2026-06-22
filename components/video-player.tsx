"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

export default function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-lg aspect-[16/9]">
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
          <p className="flex items-center gap-2 whitespace-nowrap text-white text-[11px] font-light tracking-[0.35em] uppercase">
            <Image
              src="/mhacks25_logo.svg"
              alt="MHacks 2025"
              width={130}
              height={20}
              className="h-5 w-auto"
            />
            <span>·</span>
            <span>Recap</span>
          </p>
        </div>
      )}
    </div>
  );
}
