"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useApplicationsOpen } from "./use-applications-open";
import MlhTrustBadge from "./mlh-trust-badge";

const BOX_W = 176;
const BOX_H = 224;
const LABEL_H = 22;
const LERP = 0.1;

export default function HeroSection() {
  const applicationsOpen = useApplicationsOpen();
  const boxRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const heroSize = useRef({ w: 0, h: 0 });
  const rafId = useRef<number | null>(null);
  const visible = useRef(false);
  const overButton = useRef(false);

  useEffect(() => {
    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * LERP;
      current.current.y += (target.current.y - current.current.y) * LERP;

      const imageLeft = current.current.x - BOX_W / 2;
      const imageTop = current.current.y - BOX_H / 2;

      if (boxRef.current) {
        boxRef.current.style.left = `${imageLeft}px`;
        boxRef.current.style.top = `${imageTop - LABEL_H}px`;
      }
      if (bgRef.current) {
        bgRef.current.style.left = `${-imageLeft}px`;
        bgRef.current.style.top = `${-imageTop}px`;
        bgRef.current.style.width = `${heroSize.current.w}px`;
        bgRef.current.style.height = `${heroSize.current.h}px`;
      }
      if (labelRef.current && heroSize.current.h > 0) {
        // Real latitude range centered on Ann Arbor (42.2808°N) ± 1 degree
        const ty = Math.max(
          0,
          Math.min(1, target.current.y / heroSize.current.h),
        );
        const lat = (43.2808 - ty * 2).toFixed(4);
        labelRef.current.textContent = `${lat}°N`;
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    heroSize.current = { w: rect.width, h: rect.height };

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!visible.current) {
      current.current = { x, y };
      visible.current = true;
      if (boxRef.current) {
        const el = boxRef.current;
        el.classList.remove("lens-pop");
        void el.offsetWidth; // force reflow so animation restarts
        el.classList.add("lens-pop");
        el.addEventListener(
          "animationend",
          () => {
            el.classList.remove("lens-pop");
            el.style.opacity = "1";
          },
          { once: true },
        );
      }
    }

    target.current = { x, y };
  }, []);

  const handleMouseLeave = useCallback(() => {
    visible.current = false;
    if (boxRef.current) boxRef.current.style.opacity = "0";
  }, []);

  const handleButtonEnter = useCallback(() => {
    overButton.current = true;
    if (boxRef.current) boxRef.current.style.opacity = "0";
  }, []);

  const handleButtonLeave = useCallback(() => {
    overButton.current = false;
    if (visible.current && boxRef.current) boxRef.current.style.opacity = "1";
  }, []);

  return (
    <section>
      <div
        className="relative flex min-h-screen flex-col overflow-hidden cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Mobile: original portrait bg */}
        <Image
          src="/hero_bg_w_overlay_mobile.png"
          alt="MHacks 2026"
          fill
          sizes="(max-width: 1023px) 100vw, 0px"
          className="block lg:hidden object-cover object-[65%_center] brightness-[0.88] contrast-[1.35] saturate-[1.7]"
          priority
        />
        {/* Desktop: cropped landscape bg aligned with the lens */}
        <Image
          src="/hero_bg_w_overlay.png"
          alt="MHacks 2026"
          fill
          sizes="(max-width: 1023px) 0px, 100vw"
          className="hidden lg:block object-cover object-[65%_center] brightness-[0.88] contrast-[1.35] saturate-[1.7]"
          priority
        />

        {/* Cursor-following lens */}
        <div
          ref={boxRef}
          className="pointer-events-none absolute z-[3] hidden lg:block transition-opacity duration-150"
          style={{ left: 0, top: 0, opacity: 0 }}
        >
          {/* Ann Arbor latitude — updates live with lens position */}
          <p
            ref={labelRef}
            className="font-red-hat mb-1.5 text-[13px] font-semibold tracking-widest text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
          >
            42.28°N
          </p>

          {/* Lens: overflow:hidden clips the clear bg */}
          <div
            className="relative overflow-hidden border border-white/25 shadow-[0_16px_48px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.3)]"
            style={{ width: BOX_W, height: BOX_H }}
          >
            <div
              ref={bgRef}
              style={{
                position: "absolute",
                backgroundImage: "url('/hero_bg_clear.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "65% center",
                backgroundRepeat: "no-repeat",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
          </div>
        </div>

        <div className="absolute inset-0 z-[2] bg-gradient-to-t from-black/55 to-transparent" />

        <MlhTrustBadge />

        <div className="relative z-10 flex flex-1 flex-col p-6 sm:p-8">
          {/* Top bar: logo left, apply right */}
          <div className="flex items-start justify-between">
            <Link href="/" id="hero-logo">
              <Image
                src="/mhacks_logo.png"
                alt="MHacks"
                width={56}
                height={56}
                className="w-10 h-10 sm:w-14 sm:h-14 drop-shadow-[0_0_12px_rgba(255,255,255,0.9)] brightness-[1.4]"
              />
            </Link>
            <Link
              href={applicationsOpen ? "/apply" : "#"}
              aria-disabled={!applicationsOpen}
              onClick={(e) => {
                if (!applicationsOpen) e.preventDefault();
              }}
              className="relative group hidden lg:block"
              onMouseEnter={handleButtonEnter}
              onMouseLeave={handleButtonLeave}
            >
              <span
                className={`font-red-hat inline-block rounded-full border px-5 py-2 sm:px-6 sm:py-2.5 text-[13px] sm:text-[15px] font-semibold shadow-sm backdrop-blur-md transition-opacity ${
                  applicationsOpen
                    ? "border-white/60 bg-white/85 text-zinc-900 hover:opacity-80"
                    : "cursor-not-allowed border-white/25 bg-white/25 text-white/40"
                }`}
              >
                Apply Now
              </span>
            </Link>
          </div>

          {/* Bottom: left-aligned title then dates */}
          <div className="mt-auto flex flex-col items-start pl-4 sm:pl-8 pb-6 sm:pb-10 pr-32">
            <h1
              className="font-red-hat sm:whitespace-nowrap text-[10vw] sm:text-[8vw] lg:text-[clamp(3rem,9vw,13rem)] leading-[0.9] tracking-tight uppercase"
              style={{ color: "#ebe4ce" }}
            >
              MHACKS 2026
            </h1>
            <p
              className="mt-3 text-[16px] sm:text-[18px] font-red-hat font-light tracking-[0.2em] uppercase"
              style={{ color: "#ebe4ce" }}
            >
              October 3 - 4, 2026
              <span className="hidden sm:inline">&nbsp;·&nbsp;</span>
              <br className="sm:hidden" />
              Ann Arbor, Michigan
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
