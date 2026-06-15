"use client";

import { useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

const BOX_W = 176; // w-44
const BOX_H = 224; // h-56
const LABEL_H = 22; // px — approx height of "Hackers" label + its bottom margin

export default function HeroSection() {
  const boxRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Center the image box (not the label) on the cursor
    const imageLeft = x - BOX_W / 2;
    const imageTop = y - BOX_H / 2;

    if (boxRef.current) {
      boxRef.current.style.opacity = "1";
      boxRef.current.style.left = `${imageLeft}px`;
      boxRef.current.style.top = `${imageTop - LABEL_H}px`;
    }
    if (bgRef.current) {
      // bgRef lives inside the overflow:hidden image box whose hero-coords top-left is (imageLeft, imageTop)
      bgRef.current.style.left = `${-imageLeft}px`;
      bgRef.current.style.top = `${-imageTop}px`;
      bgRef.current.style.width = `${rect.width}px`;
      bgRef.current.style.height = `${rect.height}px`;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (boxRef.current) boxRef.current.style.opacity = "0";
  }, []);

  return (
    <section className="bg-white px-3 pt-3">
      <div
        className="relative flex min-h-[94vh] flex-col overflow-hidden rounded-[2rem]"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Mobile: original portrait bg */}
        <Image
          src="/hero_bg_w_overlay_mobile.png"
          alt="MHacks 2026"
          fill
          className="block lg:hidden object-cover object-[65%_center] brightness-[0.88] contrast-[1.35] saturate-[1.7]"
          priority
        />
        {/* Desktop: cropped landscape bg aligned with the lens */}
        <Image
          src="/hero_bg_w_overlay.png"
          alt="MHacks 2026"
          fill
          className="hidden lg:block object-cover object-[65%_center] brightness-[0.88] contrast-[1.35] saturate-[1.7]"
          priority
        />

        {/* Cursor-following element: label above + clear-bg lens below */}
        <div
          ref={boxRef}
          className="pointer-events-none absolute z-[1] hidden lg:block transition-opacity duration-150"
          style={{ left: 0, top: 0, opacity: 0 }}
        >
          {/* "Hackers" label rendered above the image box */}
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/80">
            Hackers
          </p>

          {/* Image box: overflow:hidden clips the clear bg to the box bounds */}
          <div
            className="relative overflow-hidden border border-white/25 shadow-[0_16px_48px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.3)]"
            style={{ width: BOX_W, height: BOX_H }}
          >
            {/* Clear bg: sized to hero dimensions and offset so the right portion shows */}
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

        <div className="relative z-10 flex flex-1 flex-col p-6 sm:p-8">
          <Link href="/">
            <Image
              src="/mhacks_logo.png"
              alt="MHacks"
              width={56}
              height={56}
              className="w-10 h-10 sm:w-14 sm:h-14 drop-shadow-[0_0_12px_rgba(255,255,255,0.9)] brightness-[1.4]"
            />
          </Link>

          <div className="mt-auto flex justify-center">
            <div className="flex flex-col items-center sm:items-end sm:w-max">
              <div className="mb-3 flex gap-3">
                <a
                  href="#sponsors"
                  className="rounded-full border border-white/25 bg-white/[0.12] px-5 py-2 sm:px-6 sm:py-2.5 text-[13px] sm:text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md transition-all hover:bg-white/[0.22]"
                >
                  Sponsor Us
                </a>
                <a
                  id="apply"
                  href="#faqs"
                  className="rounded-full border border-white/70 bg-white/70 px-5 py-2 sm:px-6 sm:py-2.5 text-[13px] sm:text-[15px] font-medium text-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-md transition-all hover:bg-white/85"
                >
                  Apply
                </a>
              </div>

              <p className="mb-4 text-center sm:text-right text-[14px] sm:text-[18px] font-semibold tracking-wide text-white/90">
                10/03/2026 – 10/04/2026
                <span className="hidden sm:inline">&nbsp;·&nbsp;</span>
                <br className="sm:hidden" />
                University of Michigan
              </p>

              <h1 className="font-heading italic whitespace-nowrap text-[12vw] lg:text-[clamp(4rem,15vw,20rem)] leading-[0.9] tracking-tight text-white">
                MHACKS 2026
              </h1>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
