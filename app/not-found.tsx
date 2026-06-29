import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Mail } from "lucide-react";

const navLinks = [
  { href: "/#about", label: "About" },
  { href: "/#timeline", label: "Dates" },
  { href: "/#sponsors", label: "Sponsors" },
  { href: "/#faqs", label: "FAQ" },
];

const detailItems = ["October 3 - 4, 2026", "Ann Arbor, MI", "800+ Hackers"];

const pillClass =
  "border border-white/15 bg-black/[0.38] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.2)] backdrop-blur-2xl";

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-night text-cream">
      <Image
        src="/hero_bg_w_overlay.png"
        alt=""
        fill
        sizes="100vw"
        className="hidden object-cover object-[65%_center] brightness-[0.82] contrast-[1.25] saturate-[1.45] lg:block"
        priority
      />
      <Image
        src="/hero_bg_w_overlay_mobile.png"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-[62%_center] brightness-[0.78] contrast-[1.25] saturate-[1.45] lg:hidden"
        priority
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_28%,rgba(239,233,212,0.14),transparent_32%),linear-gradient(180deg,rgba(11,13,8,0.3),rgba(11,13,8,0.84))]" />

      <header className="relative z-10 flex items-start justify-between gap-5 p-6 sm:p-8">
        <Link
          href="/"
          aria-label="MHacks home"
          className="drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]"
        >
          <Image
            src="/mhacks_logo.png"
            alt="MHacks"
            width={56}
            height={56}
            className="h-10 w-10 brightness-[1.4] sm:h-14 sm:w-14"
            priority
          />
        </Link>

        <nav
          aria-label="Homepage sections"
          className={`hidden items-center gap-7 rounded-full px-6 py-3 font-heading text-lg italic text-white lg:flex ${pillClass}`}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-opacity hover:opacity-60"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/apply"
          className={`font-red-hat rounded-full px-4 pb-[7px] pt-[9px] text-[17px] italic text-white transition-opacity hover:opacity-80 lg:hidden ${pillClass}`}
        >
          Apply Now
        </Link>
      </header>

      <section className="relative z-10 flex min-h-[calc(100vh-112px)] flex-col justify-end px-6 pb-10 sm:px-8 sm:pb-14 lg:pb-16">
        <div className="max-w-6xl">
          <p className="font-mono text-[11px] uppercase text-cream/70">
            404 / Page not found
          </p>
          <h1 className="mt-4 max-w-5xl font-red-hat text-7xl font-medium uppercase leading-[0.84] tracking-normal text-[#ebe4ce] sm:text-8xl md:text-9xl lg:text-[9rem] xl:text-[12rem]">
            Lost in Ann Arbor
          </h1>
          <p className="mt-6 max-w-2xl font-red-hat text-lg font-light leading-relaxed text-cream/82 sm:text-xl">
            This path did not bloom, but MHacks is still right where you left
            it.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="font-red-hat inline-flex h-11 items-center gap-2 rounded-full border border-white/60 bg-white/85 px-5 text-sm font-semibold text-zinc-900 shadow-sm backdrop-blur-md transition-opacity hover:opacity-80"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back home
            </Link>
            <Link
              href="/apply"
              className="font-red-hat inline-flex h-11 items-center gap-2 rounded-full border border-white/25 bg-white/12 px-5 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition-opacity hover:bg-white/18"
            >
              Apply
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
            <a
              href="mailto:hackathon@mhacks.org"
              className="font-red-hat inline-flex h-11 items-center gap-2 rounded-full border border-white/25 bg-black/20 px-5 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition-opacity hover:bg-black/30"
            >
              <Mail className="size-4" aria-hidden />
              Contact
            </a>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/16 pt-5 font-red-hat text-[12px] font-light uppercase text-cream/72 sm:text-sm">
          {detailItems.map((item, index) => (
            <span key={item} className="flex items-center gap-5">
              {item}
              {index < detailItems.length - 1 ? (
                <span className="text-cream/50">◆</span>
              ) : null}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
