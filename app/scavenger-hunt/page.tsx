import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

import { LIQUID_GLASS_CARD_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Scavenger Hunt | MHacks 2026",
  description: "A secret is planted somewhere on this page. Can you find it?",
};

const SCAVENGER_IMAGE = "/marigolds-garden.gif";

// Vigenère-encrypted. The repo is public, so only the ciphertext lives here;
// regenerate it with `node scripts/vigenere.mjs <key> < plaintext.txt`.
const SCAVENGER_CIPHERTEXT =
  "Zzi tavyr htf hcfp, byr htf rohq thwbst zdsz. Nlfwspwr'g rjcgh oilzzqors we b dwabmp cbq: gtbr yz zfumotnsdt. Evsk bcs gobehsdfo oqdpdg htf gsbgf, swruor wb bmlwb ejrvh xjvs shfcmhtjyu sxtp wb fitg umsosb. Fslqy fipa raxy, obp teoff zzif eflfqt ipfs: yilqye.pcu/tuoo-am-asrobuapfg";

export default function ScavengerHuntPage() {
  return (
    <main className="font-red-hat relative min-h-screen overflow-x-clip bg-paper text-ink">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-5 pt-8 pb-16 sm:px-8 sm:pt-12">
        <Link
          href="/live"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-olive/80 transition-colors hover:text-olive"
        >
          <ArrowLeft className="size-4" />
          Back to Live
        </Link>

        <header className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-sage/45 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-olive">
            <Compass className="size-3.5" />
            Scavenger Hunt
          </span>
          <h1 className="text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            Marigold&apos;s Garden
          </h1>
        </header>

        <figure
          className={cn(
            LIQUID_GLASS_CARD_CLASS,
            "relative aspect-[765/734] overflow-hidden rounded-xl bg-black",
          )}
        >
          {/* Animated GIF: serve the file as-is so it keeps animating. */}
          <Image
            src={SCAVENGER_IMAGE}
            alt="A photograph left behind in Marigold's garden"
            fill
            priority
            unoptimized
            className="object-contain"
          />
        </figure>

        <p className="text-lg leading-8 text-ink/80">
          Before MHacks had a single line of code, it had a garden. Old Marigold
          tended it every fall, and every fall she left a message for whoever
          was curious enough to find it. This year she left only the photograph
          above and a short note: &ldquo;I never write my secrets down. I plant
          them. Look closely at what&apos;s growing, and you&apos;ll know the
          word that opens the gate.&rdquo; Her gate has only ever had one lock:
          a Vigenère cipher.
        </p>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-olive/70">
            The gate
          </h2>
          <p
            className={cn(
              LIQUID_GLASS_CARD_CLASS,
              "select-all rounded-xl p-5 font-mono text-sm leading-7 break-words text-ink sm:text-base",
            )}
          >
            {SCAVENGER_CIPHERTEXT}
          </p>
        </section>
      </div>
    </main>
  );
}
