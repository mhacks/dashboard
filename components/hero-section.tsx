"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import HeroHalftone from "@/components/hero-halftone";

const HERO_VIDEO = "/hero-flower-source.mp4";
const BOX_W = 192;
const BOX_H = 384;

function CornerHandles() {
  const square =
    "absolute size-[25px] border border-black bg-[#d2e7ff] max-sm:size-4";

  return (
    <>
      <span className={`${square} -left-[13px] -top-[13px]`} />
      <span className={`${square} -bottom-[13px] -left-[13px]`} />
      <span className={`${square} -right-[13px] -top-[13px]`} />
      <span className={`${square} -bottom-[13px] -right-[13px]`} />
    </>
  );
}

export default function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroSize, setHeroSize] = useState({ w: 0, h: 0 });
  const [lensVisible, setLensVisible] = useState(false);

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 95, damping: 22, mass: 0.8 });
  const smoothY = useSpring(pointerY, { stiffness: 95, damping: 22, mass: 0.8 });
  const lensX = useTransform(smoothX, (value) => value - BOX_W / 2);
  const lensY = useTransform(smoothY, (value) => value - BOX_H / 2);
  const imageX = useTransform(smoothX, (value) => -value + BOX_W / 2);
  const imageY = useTransform(smoothY, (value) => -value + BOX_H / 2);

  useEffect(() => {
    if (!heroRef.current) return;

    const updateSize = () => {
      const rect = heroRef.current?.getBoundingClientRect();
      if (rect) setHeroSize({ w: rect.width, h: rect.height });
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    pointerX.set(e.clientX - rect.left);
    pointerY.set(e.clientY - rect.top);
    setLensVisible(true);
  }, [pointerX, pointerY]);

  const handleMouseLeave = useCallback(() => {
    setLensVisible(false);
  }, []);

  return (
    <section id="home">
      <div
        ref={heroRef}
        className="relative flex min-h-[760px] overflow-hidden bg-black cursor-crosshair lg:h-[936px] lg:min-h-screen"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Animated pink/black halftone flower background */}
        <HeroHalftone
          src={HERO_VIDEO}
          className="absolute inset-0 h-full w-full object-cover object-[50%_center]"
        />

        <motion.div
          aria-hidden
          className="pointer-events-none absolute z-[6] hidden overflow-hidden border border-white/85 bg-black/10 shadow-[0_18px_44px_rgba(0,0,0,0.28)] lg:block"
          initial={false}
          animate={{ opacity: lensVisible ? 1 : 0, scale: lensVisible ? 1 : 0.96 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          style={{ x: lensX, y: lensY, width: BOX_W, height: BOX_H }}
        >
          <motion.div
            className="absolute left-0 top-0"
            style={{
              x: imageX,
              y: imageY,
              width: heroSize.w || "100vw",
              height: heroSize.h || "100vh",
            }}
          >
            {/* Colored flower video revealed inside the cursor frame */}
            <video
              src={HERO_VIDEO}
              muted
              loop
              playsInline
              autoPlay
              preload="auto"
              className="h-full w-full object-cover object-[50%_center]"
            />
          </motion.div>
          <span className="absolute inset-0 border border-black/45" />
        </motion.div>

        <div className="relative z-10 flex flex-1 flex-col p-8 lg:p-[42px]">
          <Link href="/" id="hero-logo" className="w-fit">
            <Image
              src="/mhacks_logo.png"
              alt="MHacks"
              width={62}
              height={60}
              className="h-[50px] w-auto brightness-[1.7] contrast-[1.15] drop-shadow-[0_0_10px_rgba(255,255,255,0.65)] lg:h-[60px]"
              priority
            />
          </Link>

          <Link
            href="#timeline"
            className="font-red-hat absolute right-7 top-8 rounded-full bg-[#ffbce1] px-8 py-2.5 text-[18px] italic tracking-[-0.04em] text-[#2a2a2a] shadow-[0_4px_2px_rgba(0,0,0,0.15)] transition-transform duration-300 hover:-translate-y-0.5 lg:right-[54px] lg:top-[42px] lg:px-10 lg:text-[20px]"
          >
            Apply Here
          </Link>

          <div className="mt-auto flex flex-col items-end gap-7 pb-8 lg:absolute lg:right-[64px] lg:top-[49.5%] lg:mt-0 lg:pb-0">
            <div
              className="relative border border-black bg-[#d2e7ff] px-5 py-4 text-center shadow-[0_4px_2px_rgba(0,0,0,0.18)] sm:px-8 lg:px-10 lg:py-5"
              onMouseEnter={() => setLensVisible(false)}
            >
              <CornerHandles />
              <h1 className="font-red-hat text-[clamp(4.5rem,14vw,8rem)] font-bold leading-[0.88] tracking-[-0.055em] text-[#2a2a2a] lg:text-[128px]">
                MHACKS
              </h1>
              <p className="font-red-hat mt-2 text-[clamp(1.2rem,4vw,2rem)] leading-none tracking-[-0.04em] text-[#2a2a2a] lg:text-[32px]">
                October 3-4 &bull; Ann Arbor, Michigan
              </p>
            </div>

            <div
              className="mr-3 bg-[#d6ff92] px-9 py-1 shadow-[0_4px_2px_rgba(0,0,0,0.18)] lg:mr-2 lg:px-12"
              onMouseEnter={() => setLensVisible(false)}
            >
              <p className="font-heading text-[clamp(4rem,12vw,6rem)] italic leading-none tracking-[-0.08em] text-[#2a2a2a] lg:text-[96px]">
                2026
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
