// Admissions decisions. Kept free of any database imports so both the drizzle
// schema and client components can share it — `lib/db/schema/applications.ts`
// builds its pgEnum from APPLICATION_DECISIONS, so the enum and this union can
// never drift apart. (lib/currency is pure formatting, no database.)

import { CONTACT } from "./config/contact";
import { RSVP_DEADLINES } from "./config/schedule";
import { EVENT } from "./config/event";
import { formatCents } from "./currency";
import { formatEventDate } from "./format/date";

export const APPLICATION_DECISIONS = [
  "applied",
  "early_accepted",
  "early_rsvped",
  "early_rejected",
  "regular_accepted",
  "regular_rsvped",
  "regular_rejected",
] as const;

export type ApplicationDecision = (typeof APPLICATION_DECISIONS)[number];

export type DecisionRound = "early" | "regular";
export type DecisionOutcome = "pending" | "accepted" | "rejected";

/** Whether a decision has been released — i.e. the letter is viewable. */
export function isDecided(decision: ApplicationDecision) {
  return decision !== "applied";
}

export function decisionOutcome(
  decision: ApplicationDecision,
): DecisionOutcome {
  if (decision === "applied") return "pending";
  return decision.endsWith("_rejected") ? "rejected" : "accepted";
}

/** Null until a decision is released — an applicant has no round before then. */
export function decisionRound(
  decision: ApplicationDecision,
): DecisionRound | null {
  if (decision === "applied") return null;
  return decision.startsWith("early_") ? "early" : "regular";
}

export function hasRsvped(decision: ApplicationDecision) {
  return decision.endsWith("_rsvped");
}

export const RSVP_URL: Record<DecisionRound, string> = {
  early: "/rsvp",
  regular: "/rsvp",
};

/**
 * Display text for each round's RSVP deadline, formatted from the instants in
 * lib/config/schedule.ts rather than written out by hand — the previous
 * hand-written version had drifted a week past what the server enforced.
 */
export const RSVP_DEADLINE: Record<DecisionRound, string> = {
  early: formatEventDate(RSVP_DEADLINES.early),
  regular: formatEventDate(RSVP_DEADLINES.regular),
};

export const SUPPORT_EMAIL = CONTACT.supportEmail;

export type DecisionLetter = {
  /** Appended to the letterhead wordmark, e.g. "Early Decision". */
  roundLabel: string;
  heading: string;
  /**
   * Rendered as separate paragraphs, in order. Rejected letters fold the
   * greeting into the first paragraph, so body[0] starts lowercase there.
   *
   * A span wrapped in **double asterisks** is emphasised by the letter
   * component. Kept as a marker rather than markup so this module stays plain
   * data and can be read by anything, not just React.
   */
  body: string[];
  /** Accepted letters only — the quiet note above the sign-off. */
  footnote?: string;
  signOff: string;
};

const SIGN_OFF = `— The ${EVENT.fullName} Team`;

const ROUND_LABEL: Record<DecisionRound, string> = {
  early: "Early Decision",
  regular: "Regular Decision",
};

const FOOTNOTE =
  "Full schedule details, check-in instructions, and hacker guides will be sent to your email as we get closer to October.";

type LetterBody = Omit<DecisionLetter, "roundLabel">;

const ACCEPTED_HEADING = `You're in! Welcome to ${EVENT.fullName}.`;

const ACCEPTED_INTRO = `Congratulations! We were thoroughly impressed by your application and are thrilled to offer you a spot at ${EVENT.fullName}. Space is limited, so please confirm your attendance below to lock in your spot.`;

// Travel reimbursement is an early-round benefit only, so the second paragraph
// of an accepted letter depends on the round and — for early — on whether the
// applicant actually has an award.
const REIMBURSEMENT_AWARDED = (amount: string) =>
  `Because you applied before the early deadline on August 7, we're also able to offer you **${amount}** in travel reimbursement toward your trip to Ann Arbor. We'll send instructions for claiming it closer to the event.`;

const REIMBURSEMENT_NONE = `Because you applied before the early deadline on August 7, you were also considered for travel reimbursement. It's limited and decided separately from admission — we would love to have you attend, but we're unable to provide reimbursement at this time. Everything else at ${EVENT.name} — meals, workshops, mentors, and the event itself — is completely free.`;

/**
 * `reimbursementCents` is the applicant's awarded tier in cents, or null when
 * they have no award at all. Returns null when the letter should stay silent on
 * reimbursement rather than address it.
 *
 * Regular-round letters never raise the subject: reimbursement is an early-round
 * benefit, so for them there is nothing to offer and nothing to decline.
 *
 * Within the early round the cases are distinct:
 *   > 0   — the award is real money, so name the amount.
 *   0     — the region-0 tier. The letter says nothing about reimbursement.
 *   null  — no award row, so the offer is addressed and declined.
 */
function reimbursementParagraph(
  round: DecisionRound,
  reimbursementCents: number | null,
): string | null {
  if (round === "regular") return null;
  if (reimbursementCents === null) return REIMBURSEMENT_NONE;
  if (reimbursementCents <= 0) return null;
  return REIMBURSEMENT_AWARDED(formatCents(reimbursementCents));
}

function acceptedLetter(
  round: DecisionRound,
  reimbursementCents: number | null,
): LetterBody {
  const reimbursement = reimbursementParagraph(round, reimbursementCents);

  return {
    heading: ACCEPTED_HEADING,
    body: reimbursement ? [ACCEPTED_INTRO, reimbursement] : [ACCEPTED_INTRO],
    footnote: FOOTNOTE,
    signOff: SIGN_OFF,
  };
}

// body[0] is prefixed with "Hi {name}, " by the letter component, so it starts
// lowercase — the rejected letter folds the greeting into the paragraph rather
// than standing it alone above the headline.
const REJECTED: Record<DecisionRound, LetterBody> = {
  early: {
    heading: `An update on your ${EVENT.fullName} application`,
    body: [
      `thank you for applying to ${EVENT.fullName}. We received a record-breaking number of applications in our early round this year, making our selection process harder than ever. Unfortunately, due to strict venue capacity, we aren't able to offer you a spot this time around.`,
      "Please know that this outcome is not a reflection of your potential or technical ability. The caliber of applications was exceptional across the board. We genuinely appreciate the time you took to share your work with us, and we hope to see your application again for future events.",
    ],
    signOff: SIGN_OFF,
  },
  regular: {
    heading: `An update on your ${EVENT.fullName} application`,
    body: [
      `thank you for applying to ${EVENT.fullName}. We received a record-breaking number of applications in our regular round this year, making our selection process harder than ever. Unfortunately, due to strict venue capacity, we aren't able to offer you a spot this time around.`,
      `This is our final decision for ${EVENT.fullName}. Please know that this outcome is not a reflection of your potential or technical ability — the caliber of applications was exceptional across the board. We genuinely appreciate the time you took to share your work with us, and we hope to see your application again for future events.`,
    ],
    signOff: SIGN_OFF,
  },
};

/**
 * The letter shown in the decision modal. Returns null while the applicant is
 * still `applied` — there is nothing to show yet.
 *
 * `reimbursementCents` is the applicant's awarded travel tier in cents, or null
 * if they have no award. It only affects accepted early-round letters; rejected
 * letters never mention reimbursement.
 */
export function decisionLetter(
  decision: ApplicationDecision,
  reimbursementCents: number | null = null,
): DecisionLetter | null {
  const round = decisionRound(decision);
  if (!round) return null;

  const outcome = decisionOutcome(decision);
  const source =
    outcome === "accepted"
      ? acceptedLetter(round, reimbursementCents)
      : REJECTED[round];

  return { roundLabel: ROUND_LABEL[round], ...source };
}
