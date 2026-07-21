"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useApplicationsOpen } from "./use-applications-open";
import posthog from "posthog-js";

const LIQUID_GLASS_PROPS = {
  displacementScale: 34,
  blurAmount: 0.16,
  saturation: 120,
  aberrationIntensity: 1.2,
  elasticity: 0.12,
  cornerRadius: 999,
  mode: "standard" as const,
};

const LiquidGlass = dynamic(() => import("liquid-glass-react"), {
  ssr: false,
});

const links = [
  { href: "/#about", label: "About" },
  // { href: "/#tracks", label: "Tracks" },
  { href: "/#timeline", label: "Dates" },
  { href: "/#sponsors", label: "Sponsors" },
  { href: "/#faqs", label: "FAQ" },
  { href: "/how-to-mcp", label: "Agent" },
];

export default function NavBar({
  forceShowLogo = false,
}: {
  /** Pages without their own top-left hero logo (unlike the landing page's
      hero) have nothing for the IntersectionObserver below to watch, so the
      navbar logo would never appear. Set this to show it immediately. */
  forceShowLogo?: boolean;
} = {}) {
  const [open, setOpen] = useState(false);
  const [showLogo, setShowLogo] = useState(forceShowLogo);
  const applicationsOpen = useApplicationsOpen();

  useEffect(() => {
    if (forceShowLogo) return;

    const heroLogo = document.getElementById("hero-logo");
    if (!heroLogo) return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowLogo(!entry.isIntersecting),
      { threshold: 0 },
    );

    observer.observe(heroLogo);
    return () => observer.disconnect();
  }, [forceShowLogo]);

  useEffect(() => {
    let rafId = 0;
    const startedAt = performance.now();
    const duration = 550;

    const tick = (now: number) => {
      window.dispatchEvent(new Event("resize"));
      if (now - startedAt < duration) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [showLogo]);

  return (
    <>
      {/* ── Mobile (< lg) ── */}
      <nav className="fixed top-6 sm:top-8 right-6 sm:right-8 z-50 lg:hidden flex items-center gap-2">
        <div className="relative group">
          <a
            href={applicationsOpen ? "/apply" : "#"}
            aria-disabled={!applicationsOpen}
            onClick={(e) => {
              if (!applicationsOpen) e.preventDefault();
              else posthog.capture("apply_now_clicked", { location: "navbar" });
            }}
            className={`glass-pill font-red-hat inline-block rounded-full px-4 pt-[9px] pb-[7px] text-[17px] italic transition-opacity ${
              applicationsOpen
                ? "text-white hover:opacity-80"
                : "cursor-not-allowed text-white/35"
            }`}
          >
            Apply Now
          </a>
        </div>

        {/* Hamburger pill + dropdown */}
        <div className="relative">
          <div className="glass-pill rounded-full flex items-center justify-center p-3">
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="relative flex items-center justify-center h-[18px] w-[18px] text-white"
            >
              <Menu
                size={18}
                className={`absolute inset-0 transition-all duration-300 ${
                  open
                    ? "rotate-90 scale-50 opacity-0"
                    : "rotate-0 scale-100 opacity-100"
                }`}
              />
              <X
                size={18}
                className={`absolute inset-0 transition-all duration-300 ${
                  open
                    ? "rotate-0 scale-100 opacity-100"
                    : "-rotate-90 scale-50 opacity-0"
                }`}
              />
            </button>
          </div>

          <div
            className={`absolute right-0 mt-2 glass-pill rounded-2xl transition-all duration-300 origin-top-right ${
              open
                ? "pointer-events-auto scale-100 opacity-100"
                : "pointer-events-none scale-95 opacity-0"
            }`}
          >
            <div className="flex flex-col gap-3 whitespace-nowrap px-5 py-4 text-lg font-heading italic text-white">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="transition-opacity hover:opacity-60"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Desktop (lg+) ── */}
      <LiquidGlass
        className="z-50 hidden lg:block"
        {...LIQUID_GLASS_PROPS}
        padding="0"
        style={{ position: "fixed", top: "2rem", left: "50%" }}
      >
        <nav
          className="glass-pill flex items-center rounded-full px-6 py-3"
          aria-label="Primary navigation"
        >
          {/* Logo slides in from the left. */}
          <div
            className="overflow-hidden flex items-center"
            style={{
              maxWidth: showLogo ? "44px" : "0px",
              opacity: showLogo ? 1 : 0,
              marginRight: showLogo ? "20px" : "0px",
              transition:
                "max-width 0.5s ease, opacity 0.4s ease, margin 0.5s ease",
              flexShrink: 0,
            }}
          >
            <Link href="/">
              <Image
                src="/mhacks_logo.png"
                alt="MHacks"
                width={24}
                height={24}
                className="brightness-[1.4] drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] block"
              />
            </Link>
            <div className="ml-5 h-[4px] w-[4px] rounded-full bg-white/70 flex-shrink-0" />
          </div>

          <div className="flex items-center gap-7 text-lg font-heading italic text-white drop-shadow-[0_1px_5px_rgba(0,0,0,0.75)]">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-opacity hover:opacity-60"
              >
                {link.label}
              </a>
            ))}
          </div>
        </nav>
      </LiquidGlass>
    </>
  );
}
