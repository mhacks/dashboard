import Image from "next/image";
import { ArrowLeft, ArrowUpRight, Mail } from "lucide-react";

import { MarketingShell } from "@/components/landing/marketing-shell";
import { CtaButton } from "@/components/landing/cta-button";
import { asset } from "@/lib/landing/asset";

const detailItems = ["October 3 - 4, 2026", "Ann Arbor, MI", "800+ Hackers"];

export default function NotFound() {
  return (
    <MarketingShell>
      <main className="relative min-h-screen overflow-hidden bg-moss-900 text-cream">
        <Image
          src={asset("/hero/hero-clean-2560.png")}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[65%_center] brightness-[0.82] contrast-[1.25] saturate-[1.45]"
          priority
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_28%,rgba(239,233,212,0.14),transparent_32%),linear-gradient(180deg,rgba(11,13,8,0.3),rgba(11,13,8,0.84))]" />

        <section className="relative z-10 flex min-h-[calc(100vh-6rem)] flex-col justify-end px-6 pb-10 pt-28 sm:px-8 sm:pb-14 lg:pb-16">
          <div className="max-w-6xl">
            <p className="font-mono text-[11px] uppercase text-cream/70">
              404 / Page not found
            </p>
            <h1 className="mt-4 max-w-5xl font-display text-7xl font-medium uppercase leading-[0.84] tracking-normal text-[#ebe4ce] sm:text-8xl md:text-9xl lg:text-[9rem] xl:text-[12rem]">
              Lost in Ann Arbor
            </h1>
            <p className="mt-6 max-w-2xl font-display text-lg font-light leading-relaxed text-cream/82 sm:text-xl">
              This path did not bloom, but MHacks is still right where you left
              it.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <CtaButton
                href="/"
                variant="glass"
                size="md"
                className="inline-flex h-11 items-center gap-2 px-5 text-sm font-semibold"
              >
                <ArrowLeft className="size-4" aria-hidden />
                Back home
              </CtaButton>
              <CtaButton
                href="/apply"
                variant="glass"
                size="md"
                className="inline-flex h-11 items-center gap-2 px-5 text-sm font-semibold"
              >
                Apply
                <ArrowUpRight className="size-4" aria-hidden />
              </CtaButton>
              <CtaButton
                href="mailto:hackathon@mhacks.org"
                variant="glass"
                size="md"
                className="inline-flex h-11 items-center gap-2 px-5 text-sm font-semibold"
              >
                <Mail className="size-4" aria-hidden />
                Contact
              </CtaButton>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/16 pt-5 font-display text-[12px] font-light uppercase text-cream/72 sm:text-sm">
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
    </MarketingShell>
  );
}
