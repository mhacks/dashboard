// Admissions decisions. Kept free of any database imports so both the drizzle
// schema and client components can share it — `lib/db/schema/applications.ts`
// builds its pgEnum from APPLICATION_DECISIONS, so the enum and this union can
// never drift apart.

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

/** RSVPing doesn't change the letter, only its call to action. */
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

// TODO: point these at the real RSVP pages once they exist.
export const RSVP_URL: Record<DecisionRound, string> = {
  early: "/rsvp/early",
  regular: "/rsvp/regular",
};

export const RSVP_DEADLINE: Record<DecisionRound, string> = {
  early: "August 28, 2026",
  regular: "September 26, 2026",
};

export const SUPPORT_EMAIL = "hackathon@mhacks.org";

export type DecisionLetter = {
  /** Appended to the letterhead wordmark, e.g. "Early Decision". */
  roundLabel: string;
  heading: string;
  /**
   * Rendered as separate paragraphs, in order. Rejected letters fold the
   * greeting into the first paragraph, so body[0] starts lowercase there.
   */
  body: string[];
  /** Accepted letters only — the quiet note above the sign-off. */
  footnote?: string;
  signOff: string;
};

const SIGN_OFF = "— The MHacks 2026 Team";

const ROUND_LABEL: Record<DecisionRound, string> = {
  early: "Early Decision",
  regular: "Regular Decision",
};

const FOOTNOTE =
  "Full schedule details, check-in instructions, and hacker guides will be sent to your email as we get closer to October.";

type LetterBody = Omit<DecisionLetter, "roundLabel">;

const ACCEPTED: Record<DecisionRound, LetterBody> = {
  early: {
    heading: "You're in! Welcome to MHacks 2026.",
    body: [
      "Congratulations! We were thoroughly impressed by your application and are thrilled to offer you a spot at MHacks 2026. Space is limited, so please confirm your attendance below to lock in your spot.",
      "Because you applied before the early deadline on August 7, you're also eligible to be considered for travel reimbursement. Reimbursement is limited and decided separately from admission, so this offer doesn't guarantee it — we'll follow up once those decisions are made.",
    ],
    footnote: FOOTNOTE,
    signOff: SIGN_OFF,
  },
  regular: {
    heading: "You're in! Welcome to MHacks 2026.",
    body: [
      "Congratulations! We were thoroughly impressed by your application and are thrilled to offer you a spot at MHacks 2026. Space is limited, so please confirm your attendance below to lock in your spot.",
      "One note on logistics: travel reimbursement is only available to applicants who applied before the early deadline on August 7, so it isn't part of this offer. Everything else at MHacks — meals, workshops, mentors, and the event itself — is completely free.",
    ],
    footnote: FOOTNOTE,
    signOff: SIGN_OFF,
  },
};

// body[0] is prefixed with "Hi {name}, " by the letter component, so it starts
// lowercase — the rejected letter folds the greeting into the paragraph rather
// than standing it alone above the headline.
const REJECTED: Record<DecisionRound, LetterBody> = {
  early: {
    heading: "An update on your MHacks 2026 application",
    body: [
      "thank you for applying to MHacks 2026. We received a record-breaking number of applications in our early round this year, making our selection process harder than ever. Unfortunately, due to strict venue capacity, we aren't able to offer you a spot this time around.",
      "Please know that this outcome is not a reflection of your potential or technical ability. The caliber of applications was exceptional across the board. We genuinely appreciate the time you took to share your work with us, and we hope to see your application again for future events.",
    ],
    signOff: SIGN_OFF,
  },
  regular: {
    heading: "An update on your MHacks 2026 application",
    body: [
      "thank you for applying to MHacks 2026. We received a record-breaking number of applications in our regular round this year, making our selection process harder than ever. Unfortunately, due to strict venue capacity, we aren't able to offer you a spot this time around.",
      "This is our final decision for MHacks 2026. Please know that this outcome is not a reflection of your potential or technical ability — the caliber of applications was exceptional across the board. We genuinely appreciate the time you took to share your work with us, and we hope to see your application again for future events.",
    ],
    signOff: SIGN_OFF,
  },
};

/**
 * The letter shown in the decision modal. Returns null while the applicant is
 * still `applied` — there is nothing to show yet.
 */
export function decisionLetter(
  decision: ApplicationDecision,
): DecisionLetter | null {
  const round = decisionRound(decision);
  if (!round) return null;

  const outcome = decisionOutcome(decision);
  const source = outcome === "accepted" ? ACCEPTED[round] : REJECTED[round];

  return { roundLabel: ROUND_LABEL[round], ...source };
}
