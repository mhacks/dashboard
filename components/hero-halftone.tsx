"use client";

import { useEffect, useRef } from "react";

/**
 * Live halftone / echo renderer ported from the Mikotone effect.
 * Downsamples a video into a low-res buffer and re-draws each cell as a box
 * scaled by brightness, with trailing pink "echo" copies — producing the
 * animated pink/black pixelated flower used as the hero background.
 */

// Effect configuration (tuned from the Mikotone export, lightened for realtime).
const RES = 150; // horizontal buffer resolution (cells across)
const CANVAS_W = 1100; // internal canvas width (cells scale to fill this)
const CONTRAST = 1.17;
const SMOOTHING = 0.5;
const MIN_SCALE = 0;
const MAX_SCALE = 1;
const ECHO_COUNT = 8;
const ECHO_TIME_OFFSET = 1;
const ECHO_DECAY = 0.82;
const ECHO_SCALE = 0.78;
const ECHO_OFFSET_X = 8;
const ECHO_OFFSET_Y = 8;
const ECHO_COLOR = "#ff0055";

export default function HeroHalftone({
  src,
  videoRef,
  className,
}: {
  src: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = localVideoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const buffer = document.createElement("canvas");
    const bctx = buffer.getContext("2d", { willReadFrequently: true });
    if (!bctx) return;

    let raf = 0;
    let visible = true;
    let brightnessCache: number[] = [];
    let history: Float32Array[] = [];

    // Pause the loop + video decode while the hero is scrolled out of view.
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const setup = () => {
      const sw = video.videoWidth;
      const sh = video.videoHeight;
      if (!sw || !sh) return;
      const aspect = sw / sh;
      canvas.width = CANVAS_W;
      canvas.height = Math.round(CANVAS_W / aspect);
      buffer.width = RES;
      buffer.height = Math.max(1, Math.round(RES / aspect));
      brightnessCache = new Array(buffer.width * buffer.height).fill(0);
      history = [];
    };

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!visible || video.readyState < 2 || !buffer.width) return;

      const w = canvas.width;
      const h = canvas.height;
      const resX = buffer.width;
      const resY = buffer.height;

      // Black background
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      bctx.drawImage(video, 0, 0, resX, resY);
      const data = bctx.getImageData(0, 0, resX, resY).data;

      const cellW = w / resX;
      const cellH = h / resY;
      const currentFrame = new Float32Array(resX * resY * 5);

      for (let y = 0; y < resY; y++) {
        for (let x = 0; x < resX; x++) {
          const idx = (y * resX + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          let brightness = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          brightness = (brightness - 0.5) * CONTRAST + 0.5;
          brightness = Math.max(0, Math.min(1, brightness));

          const cacheIdx = y * resX + x;
          brightnessCache[cacheIdx] =
            brightnessCache[cacheIdx] * SMOOTHING + brightness * (1 - SMOOTHING);
          const bVal = brightnessCache[cacheIdx];

          const fIdx = cacheIdx * 5;
          currentFrame[fIdx] = r;
          currentFrame[fIdx + 1] = g;
          currentFrame[fIdx + 2] = b;
          currentFrame[fIdx + 3] = bVal;
          currentFrame[fIdx + 4] = 1;
        }
      }

      history.push(currentFrame);
      const maxHistory = ECHO_COUNT * ECHO_TIME_OFFSET + 1;
      if (history.length > maxHistory) history.shift();

      for (let y = 0; y < resY; y++) {
        for (let x = 0; x < resX; x++) {
          const cacheIdx = y * resX + x;
          const fIdx = cacheIdx * 5;
          const r = currentFrame[fIdx];
          const g = currentFrame[fIdx + 1];
          const b = currentFrame[fIdx + 2];
          const bVal = currentFrame[fIdx + 3];
          const posX = x * cellW + cellW / 2;
          const posY = y * cellH + cellH / 2;

          // Pink echo trails (drawn furthest first)
          for (let i = ECHO_COUNT; i > 0; i--) {
            const histIdx = history.length - 1 - i * ECHO_TIME_OFFSET;
            if (histIdx < 0) continue;
            const hFrame = history[histIdx];
            const eBVal = hFrame[fIdx + 3];
            const eScaleBase = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * eBVal;
            const eScale =
              eScaleBase * Math.pow(ECHO_DECAY, i) * Math.pow(ECHO_SCALE, i);
            if (eScale <= 0.001) continue;
            const eW = cellW * eScale;
            const eH = cellH * eScale;
            ctx.save();
            ctx.translate(posX + ECHO_OFFSET_X * i, posY + ECHO_OFFSET_Y * i);
            ctx.globalAlpha = Math.pow(ECHO_DECAY, i);
            ctx.fillStyle = ECHO_COLOR;
            ctx.fillRect(-eW / 2, -eH / 2, eW, eH);
            ctx.restore();
          }

          // Main cell in source colour
          const scale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * bVal;
          if (scale <= 0.001) continue;
          const drawW = cellW * scale;
          const drawH = cellH * scale;
          ctx.save();
          ctx.translate(posX, posY);
          ctx.globalAlpha = 1;
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
          ctx.restore();
        }
      }
    };

    if (video.readyState >= 1) setup();
    video.addEventListener("loadedmetadata", setup);
    video.play().catch(() => {});
    draw();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      video.removeEventListener("loadedmetadata", setup);
    };
  }, []);

  return (
    <>
      <video
        ref={(node) => {
          localVideoRef.current = node;
          if (videoRef) videoRef.current = node;
        }}
        src={src}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        className="hidden"
      />
      <canvas ref={canvasRef} aria-hidden className={className} />
    </>
  );
}
