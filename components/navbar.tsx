"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "#about", label: "About" },
  { href: "#faqs", label: "FAQ" },
  { href: "#sponsors", label: "Sponsors" },
  { href: "/apply/hacker", label: "Apply" },
];

const pillClass =
  "border border-white/15 bg-black/[0.38] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.2)] backdrop-blur-2xl";

export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile — top right */}
      <nav className="fixed top-9 right-9 z-50 sm:hidden">
        {/* Compact toggle pill — always just icon + padding */}
        <div className={`${pillClass} rounded-full px-3 pt-3 pb-1`}>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="relative h-[18px] w-[18px] text-white"
          >
            <Menu
              size={18}
              className={`absolute inset-0 transition-all duration-300 ${
                open ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
              }`}
            />
            <X
              size={18}
              className={`absolute inset-0 transition-all duration-300 ${
                open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
              }`}
            />
          </button>
        </div>

        {/* Absolutely-positioned dropdown — never affects toggle pill width */}
        <div
          className={`absolute right-0 mt-2 ${pillClass} rounded-2xl transition-all duration-300 origin-top-right ${
            open
              ? "pointer-events-auto scale-100 opacity-100"
              : "pointer-events-none scale-95 opacity-0"
          }`}
        >
          <div className="flex flex-col gap-3 whitespace-nowrap px-5 py-4 text-[14px] font-semibold text-white">
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
      </nav>

      {/* Desktop — centered pill */}
      <nav className="fixed top-4 left-1/2 z-50 hidden -translate-x-1/2 sm:block">
        <div className={`flex items-center rounded-full ${pillClass} px-6 py-3`}>
          <div className="flex items-center gap-7 text-[17px] font-semibold text-white">
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
        </div>
      </nav>
    </>
  );
}
