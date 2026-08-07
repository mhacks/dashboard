"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { motion } from "framer-motion";

import NavBar from "@/components/navbar";
import SiteFooter from "@/components/site-footer";
import { MHacksLogo } from "@/components/mhacks-logo";
import { DecisionLetterModal } from "@/components/decision/decision-letter-modal";
import {
  decisionOutcome,
  isDecided,
  type ApplicationDecision,
} from "@/lib/decisions";

const EASE = [0.25, 0.1, 0.25, 1] as const;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="fixed inset-0 z-0">
        <Image
          src="/hero_bg_w_overlay.png"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-black/55" />
      </div>

      <NavBar forceShowLogo />

      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-col px-4 pt-32 pb-24 sm:pt-40">
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}

export function DashboardClient({
  firstName,
  decision,
  submittedAt,
}: {
  firstName: string | null;
  decision: ApplicationDecision | null;
  submittedAt: string | null;
}) {
  const [letterOpen, setLetterOpen] = useState(false);

  // No application on file yet — send them to the form.
  if (!decision) {
    return (
      <Shell>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="glass-card rounded-3xl px-8 py-12 text-center sm:px-10"
        >
          <div className="flex justify-center">
            <MHacksLogo size={44} variant="green" />
          </div>
          <h1 className="font-heading mt-6 text-4xl leading-tight tracking-tight text-moss italic">
            You haven&rsquo;t applied yet
          </h1>
          <p className="font-red-hat mt-4 text-[14px] leading-7 text-moss/65">
            Applications for MHacks 2026 are open. It takes about fifteen
            minutes, and you can save your progress as you go.
          </p>
          <Link
            href="/apply"
            className="font-red-hat mt-8 inline-block rounded-full bg-moss px-8 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-80"
          >
            Start your application
          </Link>
        </motion.div>
      </Shell>
    );
  }

  const decided = isDecided(decision);
  const outcome = decisionOutcome(decision);

  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <p className="font-red-hat text-[11px] tracking-[0.2em] text-white/60 uppercase">
          MHacks 2026
        </p>
        <h1 className="font-heading mt-2 text-5xl leading-tight tracking-tight text-white italic">
          {firstName ? `Hey, ${firstName}.` : "Your dashboard"}
        </h1>

        <div className="glass-card mt-8 rounded-3xl px-7 py-7 sm:px-9 sm:py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-red-hat text-[15px] font-semibold text-moss">
                Hacker Application
              </h2>
              {submittedAt && (
                <p className="font-red-hat mt-1 text-[13px] text-moss/55">
                  Submitted {format(new Date(submittedAt), "MMMM d, yyyy")}
                </p>
              )}
            </div>

            <span
              className={
                decided
                  ? "font-red-hat rounded-full bg-moss px-3 py-1 text-[11px] font-medium tracking-wide text-white uppercase"
                  : "font-red-hat rounded-full bg-moss/10 px-3 py-1 text-[11px] font-medium tracking-wide text-moss/70 ring-1 ring-moss/15 uppercase"
              }
            >
              {decided ? "Decision released" : "Under review"}
            </span>
          </div>

          <div className="my-6 h-px bg-moss/10" />

          {decided ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="font-red-hat max-w-sm text-[14px] leading-7 text-moss/65">
                Your decision for MHacks 2026 is ready to read.
              </p>
              <button
                type="button"
                onClick={() => setLetterOpen(true)}
                className="font-red-hat shrink-0 cursor-pointer rounded-full bg-moss px-7 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-80"
              >
                {outcome === "accepted"
                  ? "View your decision"
                  : "View decision"}
              </button>
            </div>
          ) : (
            <p className="font-red-hat text-[14px] leading-7 text-moss/65">
              Your application has been submitted and is under review. No
              further changes can be made — we&rsquo;ll let you know as soon as
              a decision is released.
            </p>
          )}

          <div className="mt-6 border-t border-moss/10 pt-5">
            <Link
              href="/apply"
              className="font-red-hat text-[13px] text-moss/55 underline underline-offset-2 transition-colors hover:text-moss"
            >
              View your submitted application
            </Link>
          </div>
        </div>
      </motion.div>

      <DecisionLetterModal
        decision={decision}
        applicantName={firstName ?? "there"}
        open={letterOpen}
        onOpenChange={setLetterOpen}
      />
    </Shell>
  );
}
