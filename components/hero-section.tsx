"use client";

import Image from "next/image";
import Link from "next/link";

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

function HeroTitleCard() {
  return (
    <div className="mt-auto flex flex-col items-end gap-7 pb-8 lg:absolute lg:right-[64px] lg:top-[75%] lg:mt-0 lg:-translate-y-1/2 lg:pb-0">
      <div className="relative border border-black bg-[#d2e7ff] px-5 py-4 text-center shadow-[0_4px_2px_rgba(0,0,0,0.18)] sm:px-8 lg:px-10 lg:py-5">
        <CornerHandles />

        <h1 className="font-red-hat text-[clamp(4.5rem,14vw,8rem)] font-bold leading-[0.88] tracking-[-0.055em] text-[#2a2a2a] lg:text-[128px]">
          MHACKS
        </h1>

        <p className="font-red-hat mt-2 text-[clamp(1.2rem,4vw,2rem)] leading-none tracking-[-0.04em] text-[#2a2a2a] lg:text-[32px]">
          October 3-4 &bull; Ann Arbor, Michigan
        </p>
      </div>

      <div className="mr-3 bg-[#d6ff92] px-9 py-1 shadow-[0_4px_2px_rgba(0,0,0,0.18)] lg:mr-2 lg:px-12">
        <p className="font-heading text-[clamp(4rem,12vw,6rem)] italic leading-none tracking-[-0.08em] text-[#2a2a2a] lg:text-[96px]">
          2026
        </p>
      </div>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section>
      <div className="relative flex min-h-screen flex-col overflow-hidden">
        <video
          ref={(el) => {
            if (el) el.playbackRate = 1.5;
          }}
          className="absolute inset-0 h-full w-full object-cover object-center"
          autoPlay
          muted
          playsInline
          preload="auto"
          poster="/hero_bg_poster.jpg"
          aria-hidden="true"
        >
          <source src="/hero_bg_trimmed.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-0 z-[2] bg-gradient-to-t from-black/55 to-transparent" />

        <div className="relative z-10 flex flex-1 flex-col p-6 sm:p-8">
          <div className="flex items-start justify-between">
            <Link href="/" id="hero-logo">
              <Image
                src="/mhacks_logo.png"
                alt="MHacks"
                width={56}
                height={56}
                className="h-10 w-10 brightness-[1.4] drop-shadow-[0_0_12px_rgba(255,255,255,0.9)] sm:h-14 sm:w-14"
              />
            </Link>

            <div className="relative hidden group lg:block">
              <span className="font-red-hat inline-block cursor-not-allowed select-none rounded-full border border-white/30 bg-white/30 px-5 py-2 text-[13px] font-medium text-zinc-800/50 backdrop-blur-md sm:px-6 sm:py-2.5 sm:text-[15px]">
                Apply Now
              </span>
              <div className="pointer-events-none absolute top-full left-1/2 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-white/90 px-3 py-1.5 text-[12px] text-zinc-700 opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100">
                Applications open Jun. 22
              </div>
            </div>
          </div>

          {/* <div className="mt-auto flex flex-col items-start pb-6 pl-4 sm:pb-10 sm:pl-8"> */}
{/*             
            <h1
              className="font-red-hat text-[10vw] leading-[0.9] tracking-tight uppercase sm:whitespace-nowrap sm:text-[8vw] lg:text-[clamp(3rem,9vw,13rem)]"
              style={{ color: "#ebe4ce" }}
            >
              MHACKS 2026
            </h1>

            <p
              className="font-red-hat mt-3 text-[16px] font-light tracking-[0.2em] uppercase sm:text-[18px]"
              style={{ color: "#ebe4ce" }}
            >
              October 3 - 4, 2026
              <span className="hidden sm:inline">&nbsp;·&nbsp;</span>
              <br className="sm:hidden" />
              Ann Arbor, Michigan
            </p> */}
          {/* </div>  */}
          <HeroTitleCard />
          
        </div>
      </div>
    </section>
  );
}

