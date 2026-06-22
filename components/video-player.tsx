"use client";

export default function VideoPlayer() {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-lg aspect-[16/9]">
      <video
        className="w-full h-full object-cover"
        controls
        playsInline
        src="https://d1vfxy18qt9x1k.cloudfront.net/MHacks%202025%20Recap%20Final%20Draft.mp4"
      />
    </div>
  );
}
