"use client";

import { useEffect } from "react";
import { useReducedMotion } from "framer-motion";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventDetails } from "@/components/decision/event-details";
import { LetterButtonLink } from "@/components/decision/letter-button";
import { Letterhead } from "@/components/decision/letterhead";
import { MHacksBadge } from "@/components/decision/mhacks-badge";
import {
  decisionLetter,
  decisionOutcome,
  decisionRound,
  hasRsvped,
  RSVP_DEADLINE,
  RSVP_URL,
  type ApplicationDecision,
} from "@/lib/decisions";

const CONFETTI_COLORS = ["#3a4a26", "#445721", "#5d6b3a", "#bec59b", "#efe9d4"];

async function celebrate() {
  const { default: confetti } = await import("canvas-confetti");
  const shared = {
    colors: CONFETTI_COLORS,
    disableForReducedMotion: true,
    zIndex: 100,
    scalar: 0.9,
  };
  confetti({ ...shared, particleCount: 80, spread: 70, origin: { y: 0.3 } });
  window.setTimeout(() => {
    confetti({
      ...shared,
      particleCount: 50,
      spread: 100,
      startVelocity: 35,
      origin: { x: 0.2, y: 0.35 },
    });
    confetti({
      ...shared,
      particleCount: 50,
      spread: 100,
      startVelocity: 35,
      origin: { x: 0.8, y: 0.35 },
    });
  }, 180);
}

/**
 * Letter copy marks emphasis with **double asterisks** — currently just the
 * travel reimbursement amount. Splitting on a capturing group puts the marked
 * spans at the odd indices, which are the ones that get bolded.
 */
function renderParagraph(paragraph: string) {
  return paragraph.split(/\*\*(.+?)\*\*/g).map((segment, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {segment}
      </strong>
    ) : (
      segment
    ),
  );
}

export function DecisionLetterModal({
  decision,
  applicantName,
  reimbursementCents = null,
  open,
  onOpenChange,
}: {
  decision: ApplicationDecision;
  applicantName: string;
  /** Awarded travel tier in cents, or null when there's no award. */
  reimbursementCents?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  const letter = decisionLetter(decision, reimbursementCents);
  const round = decisionRound(decision);
  const outcome = decisionOutcome(decision);
  const accepted = outcome === "accepted";
  const rsvped = hasRsvped(decision);

  useEffect(() => {
    if (!open || !accepted || reduceMotion) return;
    void celebrate();
  }, [open, accepted, reduceMotion]);

  // Nothing to show while the applicant is still `applied`.
  if (!letter || !round) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="letter"
        className="rounded-card border border-ink/15 bg-paper p-0 text-base text-ink shadow-card ring-0"
        overlayClassName="bg-transparent supports-backdrop-filter:backdrop-blur-none"
        overlayChildren={
          <div data-decision={outcome} className="absolute inset-0">
            <div className="backdrop-photo absolute inset-0 bg-moss bg-cover bg-center bg-no-repeat" />
            <div className="backdrop-scrim absolute inset-0" />
          </div>
        }
      >
        <Letterhead roundLabel={letter.roundLabel} />

        {accepted ? (
          <>
            <section className="px-[22px] pt-9 pb-6 sm:px-[34px]">
              <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <p className="font-red-hat mb-3 text-lg font-medium text-ink/60">
                    Hi {applicantName},
                  </p>

                  <DialogTitle className="font-red-hat mb-4 text-[27px] leading-[1.1] font-bold tracking-[-0.02em] text-moss sm:text-[34px]">
                    {letter.heading}
                  </DialogTitle>

                  <DialogDescription className="text-base leading-[1.65] text-ink">
                    {renderParagraph(letter.body[0])}
                  </DialogDescription>

                  {letter.body.slice(1).map((paragraph) => (
                    <p
                      key={paragraph}
                      className="mt-4 text-base leading-[1.65] text-ink"
                    >
                      {renderParagraph(paragraph)}
                    </p>
                  ))}
                </div>

                <div className="max-sm:order-first max-sm:mb-1">
                  <MHacksBadge round={round} />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                {rsvped ? (
                  <>
                    <span className="font-red-hat inline-flex items-center justify-center gap-2 rounded-full border border-confirmed-ink bg-confirmed px-7 py-3.5 text-[15px] font-semibold text-confirmed-ink max-sm:w-full">
                      ✓ RSVP Confirmed
                    </span>
                    <p className="font-red-hat text-xs font-semibold tracking-[0.08em] text-ink/60 max-sm:w-full">
                      Your spot is locked in
                    </p>
                  </>
                ) : (
                  <>
                    <LetterButtonLink href={RSVP_URL[round]} variant="primary">
                      Confirm My RSVP
                    </LetterButtonLink>
                    <p className="font-red-hat text-xs font-semibold tracking-[0.08em] text-ink/60 max-sm:w-full">
                      RSVP by {RSVP_DEADLINE[round]}
                    </p>
                  </>
                )}
              </div>
            </section>

            <EventDetails />

            <footer className="border-t border-ink/15 bg-paper px-[22px] pt-4 pb-6 sm:px-[34px]">
              {letter.footnote && (
                <p className="text-[13.5px] leading-relaxed text-ink/60">
                  {letter.footnote}
                </p>
              )}
              <p className="font-red-hat mt-3 text-[15px] font-semibold text-moss">
                {letter.signOff}
              </p>
            </footer>
          </>
        ) : (
          <section className="px-[22px] pt-9 pb-6 sm:px-[34px]">
            <DialogTitle className="font-red-hat mb-4 text-[23px] leading-[1.1] font-medium tracking-[-0.01em] text-moss sm:text-[28px]">
              {letter.heading}
            </DialogTitle>

            <DialogDescription className="mb-4 text-base leading-[1.65] text-ink">
              Hi {applicantName}, {renderParagraph(letter.body[0])}
            </DialogDescription>

            {letter.body.slice(1).map((paragraph) => (
              <p
                key={paragraph}
                className="text-base leading-[1.65] text-ink not-first:mt-4"
              >
                {renderParagraph(paragraph)}
              </p>
            ))}

            <p className="font-red-hat mt-6 text-[15px] font-semibold text-moss">
              {letter.signOff}
            </p>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
