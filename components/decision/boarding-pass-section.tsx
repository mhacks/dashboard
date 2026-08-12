import { LetterButtonLink } from "@/components/decision/letter-button";

/*
  The boarding pass section of the acceptance letter.

  It has to stand out without competing with RSVP, which is the only filled
  button in the letter and the only action with a deadline. So it earns
  attention with surface and artifact rather than weight: sage is the one
  chromatic band in a letter otherwise built from paper and haze, and the CTA
  stays at outline.

  The thing that does the explaining is the miniature pass itself — notches,
  perforation, barcode, and the reader's own name in the passenger slot. A
  paragraph can say "customizable shareable graphic"; a ticket with your name
  on it just shows you.
*/

/** Matches the studio's own empty state (lib/pass — PLACEHOLDER). */
const PLACEHOLDER = "YOUR NAME HERE";

/**
 * The dashboard passes "there" when an applicant has no first name on file,
 * which is fine in "Hi there," and wrong printed across a ticket.
 */
function passengerLine(applicantName: string): string {
  const name = applicantName.trim();
  if (!name || name.toLowerCase() === "there") return PLACEHOLDER;
  return name.toUpperCase();
}

/**
 * Bars at irregular widths — an even comb reads as a barcode icon, not a
 * barcode. Not worth a component; it is four stops of a gradient.
 */
const BARCODE = {
  backgroundImage:
    "repeating-linear-gradient(90deg, var(--color-ink) 0 1px, transparent 1px 3px, " +
    "var(--color-ink) 3px 5px, transparent 5px 6px, var(--color-ink) 6px 7px, transparent 7px 10px)",
} as const;

function MiniPass({ passenger }: { passenger: string }) {
  const empty = passenger === PLACEHOLDER;

  return (
    /*
      Decorative: every word on it is either repeated in the copy beside it or
      is the reader's own name, so announcing it would only be noise. Tilted
      the way MHacksBadge is — the seal and the pass are the same gesture.
    */
    <div
      aria-hidden
      className="shadow-e-2 flex w-full max-w-[280px] -rotate-[1.5deg] rounded-tile bg-paper select-none"
    >
      <div className="min-w-0 flex-1 px-[14px] py-3">
        <p className="font-red-hat-mono text-[7px] tracking-[0.22em] text-moss/60 uppercase">
          MHacks · Boarding pass
        </p>

        <p className="font-red-hat-mono mt-3 text-[6.5px] tracking-[0.24em] text-fern uppercase">
          Passenger
        </p>
        <p
          className={`font-red-hat truncate text-[15px] leading-none font-bold tracking-[-0.02em] text-moss ${
            empty ? "opacity-30" : ""
          }`}
        >
          {passenger}
        </p>

        <div className="mt-3 flex items-end gap-4">
          <div className="min-w-0">
            <p className="font-red-hat-mono text-[6.5px] tracking-[0.24em] text-fern uppercase">
              From
            </p>
            <p className="font-red-hat-mono text-[8.5px] leading-none text-moss/35">
              ——
            </p>
          </div>
          <div>
            <p className="font-red-hat-mono text-[6.5px] tracking-[0.24em] text-fern uppercase">
              To
            </p>
            <p className="font-red-hat-mono text-[8.5px] leading-none text-moss">
              ANN ARBOR
            </p>
          </div>
        </div>
      </div>

      {/* The tear-off. The notches are the band's own colour punched into the
          ticket's edge, which is what makes the perforation read as one. */}
      <div className="relative flex w-[52px] shrink-0 items-center justify-center border-l border-dashed border-ink/25">
        <span className="absolute -top-[5px] -left-[5px] size-[9px] rounded-full bg-sage" />
        <span className="absolute -bottom-[5px] -left-[5px] size-[9px] rounded-full bg-sage" />
        <span className="h-8 w-[30px] opacity-70" style={BARCODE} />
      </div>
    </div>
  );
}

export function BoardingPassSection({
  applicantName,
}: {
  applicantName: string;
}) {
  return (
    <section
      aria-labelledby="boarding-pass-title"
      className="border-t border-ink/15 bg-sage px-[22px] pt-6 pb-8 sm:px-[34px]"
    >
      <p
        id="boarding-pass-title"
        className="font-red-hat mb-5 text-[11px] font-semibold tracking-[0.28em] text-olive uppercase"
      >
        Your boarding pass
      </p>

      <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8">
        <MiniPass passenger={passengerLine(applicantName)} />

        <div>
          <p className="font-red-hat text-[19px] leading-[1.15] font-bold tracking-[-0.01em] text-moss sm:text-[22px]">
            Tell people you&rsquo;re going.
          </p>
          <p className="mt-2 text-[14.5px] leading-[1.55] text-ink/80">
            Put your name on a pass, choose a backdrop and stickers, then
            download it sized for an Instagram story, a post, or LinkedIn.
          </p>

          <div className="mt-5">
            <LetterButtonLink href="/dashboard/pass" variant="outline">
              Design your pass
            </LetterButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
