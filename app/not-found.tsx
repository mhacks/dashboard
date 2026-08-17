import Image from "next/image";

import { MlhBadge } from "@/components/landing/MlhBadge";
import { CtaButton } from "@/components/landing/cta-button";
import { asset } from "@/lib/landing/asset";
import { GRAIN_140 } from "@/lib/landing/textures";
import { EVENT } from "@/lib/config/event";

const DOT_GRID = [
  "radial-gradient(circle, rgba(255,255,255,0.3) 0.5px, transparent 0.5px)",
  "radial-gradient(circle, rgba(255,255,255,0.16) 0.5px, transparent 0.5px)",
].join(", ");

export default function NotFound() {
  return (
    <div className="marketing-site grain min-h-screen">
      <main className="relative min-h-screen w-full overflow-hidden bg-moss-900 text-cream">
        <div className="absolute inset-0">
          <div className="absolute inset-0 isolate overflow-hidden">
            <div className="absolute -inset-[12%]">
              <Image
                src={asset("/hero/hero-clean-blur.webp")}
                alt=""
                aria-hidden
                fill
                sizes="100vw"
                priority
                unoptimized
                draggable={false}
                className="object-cover object-[50%_58%]"
              />
            </div>

            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: DOT_GRID,
                backgroundSize: "3px 3px, 3px 3px",
                backgroundPosition: "0 0, 1.5px 1.5px",
                mixBlendMode: "soft-light",
                opacity: 0.75,
              }}
            />

            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "rgba(18, 36, 48, 0.08)" }}
            />

            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(29,36,18,0.18) 0%, rgba(29,36,18,0.04) 38%, rgba(29,36,18,0.42) 100%)",
              }}
            />
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 80% at 50% 0%, rgba(29,36,18,0.2) 0%, rgba(29,36,18,0) 55%)",
            }}
          />

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.15), transparent 40%)",
            }}
          />

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: GRAIN_140,
              backgroundSize: "140px 140px",
              opacity: 0.38,
            }}
          />
        </div>

        <MlhBadge />

        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
          <div className="flex flex-col items-center gap-4 text-center md:gap-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-cream md:text-[13px] md:tracking-[0.3em] [text-shadow:0_1px_12px_rgba(20,30,10,0.55)]">
              404 / Page not found
            </p>

            <h1
              className="font-serif-it text-cream"
              style={{
                fontSize: "clamp(44px, 12vw, 180px)",
                lineHeight: 0.9,
                letterSpacing: "-0.025em",
                textShadow: "0 6px 40px rgba(20,30,10,0.35)",
              }}
            >
              Lost in Ann Arbor
            </h1>

            <p className="max-w-md text-[11px] font-medium uppercase tracking-[0.18em] text-cream md:text-[13px] md:tracking-[0.3em] [text-shadow:0_1px_12px_rgba(20,30,10,0.55)]">
              This path did not bloom, but {EVENT.name} is still right where you
              left it.
            </p>

            <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
              <CtaButton href="/" variant="cta" size="md" className="w-[200px]">
                Back home
              </CtaButton>
              {/* Via the dashboard, like every other Apply entry point — it
                  routes on to the form, a saved draft, or a submitted
                  application as appropriate. */}
              <CtaButton
                href="/dashboard"
                variant="parchment"
                size="md"
                className="w-[200px]"
              >
                Apply
              </CtaButton>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
