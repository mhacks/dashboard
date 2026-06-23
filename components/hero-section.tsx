"use client";

import { useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useApplicationsOpen } from "./use-applications-open";

const BOX_W = 210;
const BOX_H = 270;

/** Corner squares sitting outside the MHACKS title box corners */
function TitleFiducials() {
  const sq = "absolute w-2.5 h-2.5 border border-black";
  const color = { backgroundColor: "#d2e7ff" };
  return (
    <>
      <span className={`${sq} -top-[5px] -left-[5px]`} style={color} />
      <span className={`${sq} -top-[5px] -right-[5px]`} style={color} />
      <span className={`${sq} -bottom-[5px] -left-[5px]`} style={color} />
      <span className={`${sq} -bottom-[5px] -right-[5px]`} style={color} />
    </>
  );
}

export default function HeroSection() {
  const applicationsOpen = useApplicationsOpen();
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const boxLeft = x - BOX_W / 2;
    const boxTop = y - BOX_H / 2;

    if (boxRef.current) {
      boxRef.current.style.opacity = "1";
      boxRef.current.style.left = `${boxLeft}px`;
      boxRef.current.style.top = `${boxTop}px`;
    }
    if (imgRef.current) {
      // offset the full-hero-sized flower so the correct portion shows through the box viewport
      imgRef.current.style.left = `${-boxLeft}px`;
      imgRef.current.style.top = `${-boxTop}px`;
      imgRef.current.style.width = `${rect.width}px`;
      imgRef.current.style.height = `${rect.height}px`;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (boxRef.current) boxRef.current.style.opacity = "0";
  }, []);

  return (
    <section>
      <div
        className="relative flex min-h-screen flex-col overflow-hidden"
        style={{ backgroundColor: "#0b0c0a" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* ASCII flower background */}
        <Image
          src="/hero_ascii_bg.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center pointer-events-none select-none"
          priority
        />

        {/* Cursor-following lens box (desktop only) */}
        <div
          ref={boxRef}
          className="pointer-events-none absolute z-[5] hidden lg:block transition-opacity duration-150"
          style={{ width: BOX_W, height: BOX_H, left: 0, top: 0, opacity: 0, overflow: "hidden", border: "2px solid rgba(255,255,255,0.5)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
        >
          {/* Full-hero-sized clear flower photo, offset so the cursor-aligned portion shows */}
          <div
            ref={imgRef}
            style={{
              position: "absolute",
              backgroundImage: "url('/hero_flower_portrait.png')",
              backgroundSize: "cover",
              backgroundPosition: "center center",
              backgroundRepeat: "no-repeat",
            }}
          />
        </div>

        {/* Slight vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40 pointer-events-none" />

        <div className="relative z-10 flex flex-1 flex-col p-6 sm:p-8 lg:p-10">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <Link href="/" id="hero-logo">
              <Image
                src="/mhacks_logo.png"
                alt="MHacks"
                width={40}
                height={40}
                className="w-9 h-9 sm:w-10 sm:h-10 brightness-[2] drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
              />
            </Link>
            <Link
              href={applicationsOpen ? "/apply" : "#"}
              aria-disabled={!applicationsOpen}
              onClick={(e) => { if (!applicationsOpen) e.preventDefault(); }}
              className={`font-red-hat inline-block rounded-full px-6 py-2.5 text-[15px] font-semibold transition-opacity ${
                applicationsOpen
                  ? "hover:opacity-80"
                  : "cursor-not-allowed opacity-50"
              }`}
              style={{ backgroundColor: "#ef7daf", color: "#1a0010" }}
            >
              Apply Here →
            </Link>
          </div>

          {/* Center content: portrait photo + title box */}
          <div className="flex-1 flex items-center justify-center px-4 sm:px-8">
            <div className="flex items-end gap-4 sm:gap-6 lg:gap-8 w-full max-w-5xl">
              {/* Portrait photo */}
              <div
                className="hidden sm:block shrink-0 overflow-hidden"
                style={{
                  width: "clamp(120px, 14vw, 200px)",
                  height: "clamp(160px, 19vw, 280px)",
                  border: "3px solid rgba(255,255,255,0.7)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                }}
              >
                <Image
                  src="/hero_flower_portrait.png"
                  alt=""
                  width={400}
                  height={560}
                  className="w-full h-full object-cover object-center pointer-events-none select-none"
                />
              </div>

              {/* Title box — #d2e7ff bg, black border */}
              <div className="flex-1 relative min-w-0">
                <div
                  className="relative px-6 py-5 sm:px-8 sm:py-7 lg:px-10 lg:py-8"
                  style={{ backgroundColor: "#d2e7ff", border: "1px solid black" }}
                >
                  <TitleFiducials />
                  <h1
                    className="font-red-hat font-bold leading-[0.9] tracking-tight uppercase"
                    style={{
                      color: "#2a2a2a",
                      fontSize: "clamp(3rem, 10vw, 8rem)",
                    }}
                  >
                    MHACKS
                  </h1>
                  <p
                    className="font-red-hat font-normal mt-2 sm:mt-3"
                    style={{
                      color: "#2a2a2a",
                      fontSize: "clamp(0.85rem, 2vw, 1.5rem)",
                    }}
                  >
                    October 3-4&nbsp;•&nbsp;Ann Arbor, Michigan
                  </p>
                </div>

                {/* 2026 badge — #d6ff92 bg, black border, drop shadow */}
                <div
                  className="mt-0 ml-auto inline-block px-8 py-2 sm:px-10 sm:py-3"
                  style={{
                    backgroundColor: "#d6ff92",
                    border: "1px solid black",
                    boxShadow: "0px 4px 2px rgba(0,0,0,0.25)",
                  }}
                >
                  <span
                    className="font-heading italic"
                    style={{
                      color: "#2a2a2a",
                      fontSize: "clamp(2rem, 5vw, 4.5rem)",
                      lineHeight: 1,
                    }}
                  >
                    2026
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
