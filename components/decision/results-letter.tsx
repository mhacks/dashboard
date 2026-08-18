import { ButtonLink } from "@/components/console/button";
import {
  LetterBody,
  LetterHeading,
  LetterKicker,
  LetterSection,
  LetterTitle,
  Showcase,
  Signoff,
} from "@/components/console/letter";
import { PanelBar } from "@/components/console/panel";
import { ConsoleShell } from "@/components/console/shell";
import { BoardingPassSection } from "@/components/decision/boarding-pass-section";
import { Celebrate } from "@/components/decision/celebrate";
import { DecisionBackdrop } from "@/components/decision/decision-backdrop";
import { EventDetails } from "@/components/decision/event-details";
import { renderParagraph } from "@/components/decision/render-paragraph";
import { RsvpButton } from "@/components/decision/rsvp-button";
import { EVENT } from "@/lib/config/event";
import {
  decisionLetter,
  decisionOutcome,
  decisionRound,
  RSVP_DEADLINE,
  type ApplicationDecision,
} from "@/lib/decisions";

/**
 * The decision letter, as a page.
 *
 * It reads as a newsletter: welcome + RSVP, then the event details, then the
 * optional extras, on alternating paper/well bands.
 *
 * Copy comes from lib/decisions.ts, which is round-aware and knows about
 * travel reimbursement. This component owns the structure; it never owns the
 * words, apart from the extras below that describe products rather than a
 * decision.
 */
export function ResultsLetter({
  decision,
  applicantName,
  reimbursementCents = null,
  /**
   * Both are future additions. The bands exist and are wired; supplying a URL
   * is all it takes to turn one on. Discord is deliberately accepted-only —
   * that community is for accepted hackers, so it must never be reachable from
   * the rejected branch.
   */
  discordInviteUrl,
  bouquetGameUrl,
}: {
  decision: ApplicationDecision;
  applicantName: string;
  reimbursementCents?: number | null;
  discordInviteUrl?: string;
  bouquetGameUrl?: string;
}) {
  const letter = decisionLetter(decision, reimbursementCents);
  const round = decisionRound(decision);
  const outcome = decisionOutcome(decision);

  // Nothing to show while the applicant is still `applied`. The route guards
  // this too, so reaching here means a decision exists.
  if (!letter || !round) return null;

  const accepted = outcome === "accepted";

  return (
    <div data-decision={outcome} className="relative min-h-screen">
      <DecisionBackdrop outcome={accepted ? "accepted" : "rejected"} />

      <main className="relative z-10">
        {/*
          `centred` for the rejection, the one screen short enough to sit in
          the middle of the window and the one that should: a short letter
          pinned to the top of a tall photograph reads as an offcut.
        */}
        <ConsoleShell width="letter" field={false} centred={!accepted}>
          <article>
            <PanelBar
              eyebrow={`${EVENT.fullName.toUpperCase()} · ${letter.roundLabel}`}
            />

            {accepted ? (
              <AcceptedBody
                letter={letter}
                applicantName={applicantName}
                deadline={RSVP_DEADLINE[round]}
                discordInviteUrl={discordInviteUrl}
                bouquetGameUrl={bouquetGameUrl}
              />
            ) : (
              <RejectedBody letter={letter} applicantName={applicantName} />
            )}
          </article>
        </ConsoleShell>
      </main>

      {accepted ? <Celebrate /> : null}
    </div>
  );
}

type Letter = NonNullable<ReturnType<typeof decisionLetter>>;

function AcceptedBody({
  letter,
  applicantName,
  deadline,
  discordInviteUrl,
  bouquetGameUrl,
}: {
  letter: Letter;
  applicantName: string;
  deadline: string;
  discordInviteUrl?: string;
  bouquetGameUrl?: string;
}) {
  return (
    <>
      <LetterSection>
        <p className="mb-2.5 font-red-hat-mono text-sm text-ui-ink-soft">
          Hi {applicantName},
        </p>

        <LetterTitle>{letter.heading}</LetterTitle>

        {letter.body.map((paragraph) => (
          <LetterBody key={paragraph}>{renderParagraph(paragraph)}</LetterBody>
        ))}

        <RsvpButton deadline={deadline} />
      </LetterSection>

      <LetterSection tone="well">
        <EventDetails />
      </LetterSection>

      <LetterSection>
        <BoardingPassSection />
      </LetterSection>

      {discordInviteUrl ? (
        <LetterSection tone="well">
          <LetterKicker>Next Step</LetterKicker>
          <LetterHeading>Join the hacker Discord</LetterHeading>
          <LetterBody>
            Our Discord is where accepted hackers meet before the weekend starts
            &mdash; find teammates, ask mentors questions, and get every
            schedule update first. It&rsquo;s the fastest way to reach the
            organizing team, and your invite is ready now.
          </LetterBody>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <ButtonLink href={discordInviteUrl} variant="outline">
              Join the {EVENT.name} Discord
            </ButtonLink>
          </div>
        </LetterSection>
      ) : null}

      {bouquetGameUrl ? (
        <LetterSection>
          <LetterKicker>Optional &amp; Fun</LetterKicker>
          <LetterHeading>The bouquet game</LetterHeading>

          {/* Enabling this band also needs sticker-bouquet.png copied into
              public/decision — it is not in the repo yet. */}
          <Showcase
            image="/decision/sticker-bouquet.png"
            width={512}
            height={512}
            caption="MFlower"
            cutout
          >
            <LetterBody>
              Design your own flower bouquet with Michigan-native wildflowers!
              Download your bouquet as a sticker to decorate your {EVENT.name}
              boarding pass. Remember to tag us on social media for a feature!
            </LetterBody>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <ButtonLink href={bouquetGameUrl} variant="secondary">
                Design your bouquet
              </ButtonLink>
            </div>
          </Showcase>
        </LetterSection>
      ) : null}

      <LetterSection tone="well">
        {letter.footnote ? (
          <p className="m-0 text-[13px] leading-relaxed text-ui-ink-soft">
            {letter.footnote}
          </p>
        ) : null}
        <Signoff>{letter.signOff}</Signoff>
      </LetterSection>
    </>
  );
}

/**
 * No status, no details, no extras. The greeting is folded into the first
 * paragraph rather than standing alone above the headline — lib/decisions.ts
 * writes body[0] lowercase for exactly this.
 */
function RejectedBody({
  letter,
  applicantName,
}: {
  letter: Letter;
  applicantName: string;
}) {
  const [first, ...rest] = letter.body;

  return (
    <LetterSection>
      <LetterTitle quiet>{letter.heading}</LetterTitle>

      <LetterBody>
        Hi {applicantName}, {renderParagraph(first)}
      </LetterBody>

      {rest.map((paragraph) => (
        <LetterBody key={paragraph}>{renderParagraph(paragraph)}</LetterBody>
      ))}

      <Signoff>{letter.signOff}</Signoff>
    </LetterSection>
  );
}
