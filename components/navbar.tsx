"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "#about", label: "About" },
  { href: "#stats", label: "Tracks" },
  { href: "#timeline", label: "Dates" },
  { href: "#sponsors", label: "Sponsors" },
  { href: "#faqs", label: "FAQ" },
];

const pillClass =
  "border border-[rgba(31,42,22,0.1)] bg-white shadow-[0_8px_16px_rgba(31,42,22,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]";

export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Mobile (< lg) ── */}
      <nav className="fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2 lg:hidden">
        {/* Hamburger pill + dropdown */}
        <div className="relative">
          <div
            className={`${pillClass} flex items-center justify-center rounded-full p-3`}
          >
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="relative flex h-[18px] w-[18px] items-center justify-center text-[#1f2a16]"
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
            className={`absolute left-1/2 mt-2 -translate-x-1/2 ${pillClass} origin-top rounded-2xl transition-all duration-300 ${
              open
                ? "pointer-events-auto scale-100 opacity-100"
                : "pointer-events-none scale-95 opacity-0"
            }`}
          >
            <div className="font-red-hat flex flex-col gap-3 whitespace-nowrap px-5 py-4 text-center text-[15px] font-medium text-[rgba(31,42,22,0.72)]">
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
      <nav className="fixed left-1/2 top-[44px] z-50 hidden -translate-x-1/2 lg:block">
        <div
          className={`flex items-center gap-1 rounded-full ${pillClass} p-[7px]`}
        >
          <div className="font-red-hat flex items-center text-[13.5px] font-medium leading-[20.25px]">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-4 py-2 text-[rgba(31,42,22,0.7)] transition-colors duration-300 first:bg-[#d2e7ff] first:text-[#010101] hover:bg-[#eef6ec]"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
