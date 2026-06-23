"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import { useApplicationsOpen } from "./use-applications-open";

const links = [
  { href: "#about", label: "About" },
  { href: "#faqs", label: "FAQ" },
  { href: "#sponsors", label: "Sponsors" },
];

const pillClass =
  "border border-white/20 bg-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl";

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const [showLogo, setShowLogo] = useState(false);
  const applicationsOpen = useApplicationsOpen();

  useEffect(() => {
    const heroLogo = document.getElementById("hero-logo");
    if (!heroLogo) return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowLogo(!entry.isIntersecting),
      { threshold: 0 },
    );

    observer.observe(heroLogo);
    return () => observer.disconnect();
  }, []);

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
            }}
            className={`${pillClass} font-red-hat inline-block rounded-full px-4 pt-[9px] pb-[7px] text-[17px] italic transition-opacity ${
              applicationsOpen
                ? "text-zinc-900 hover:opacity-80"
                : "cursor-not-allowed text-zinc-900/35"
            }`}
          >
            Apply
          </a>
        </div>

        {/* Hamburger pill + dropdown */}
        <div className="relative">
          <div
            className={`${pillClass} rounded-full flex items-center justify-center p-3`}
          >
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="relative flex items-center justify-center h-[18px] w-[18px] text-zinc-900"
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
            className={`absolute right-0 mt-2 ${pillClass} rounded-2xl transition-all duration-300 origin-top-right ${
              open
                ? "pointer-events-auto scale-100 opacity-100"
                : "pointer-events-none scale-95 opacity-0"
            }`}
          >
            <div className="flex flex-col gap-3 whitespace-nowrap px-5 py-4 text-lg font-heading italic text-zinc-900">
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
      <nav className="fixed top-4 left-1/2 z-50 hidden -translate-x-1/2 lg:block">
        <div
          className={`flex items-center rounded-full ${pillClass} px-8 py-[10px]`}
        >
          {/* Logo slides in from the left */}
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
            <a href="#">
              <Image
                src="/mhacks_logo.png"
                alt="MHacks"
                width={24}
                height={24}
                className="block"
              />
            </a>
            <div className="ml-5 h-[4px] w-[4px] rounded-full bg-zinc-900/50 flex-shrink-0" />
          </div>

          <div className="flex items-center gap-[50px] text-[22px] font-red-hat font-semibold text-zinc-900">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-opacity hover:opacity-60"
              >
                {link.label}
              </a>
            ))}
            <a
              href={applicationsOpen ? "/apply" : "#"}
              aria-disabled={!applicationsOpen}
              onClick={(e) => {
                if (!applicationsOpen) e.preventDefault();
              }}
              className={`transition-opacity ${
                applicationsOpen
                  ? "hover:opacity-60"
                  : "cursor-not-allowed opacity-40"
              }`}
            >
              Apply
            </a>
          </div>
        </div>
      </nav>
    </>
  );
}
