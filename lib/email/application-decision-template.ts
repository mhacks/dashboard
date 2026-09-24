import {
  decisionLetter,
  decisionOutcome,
  type ApplicationDecision,
} from "@/lib/decisions";
import { renderCampaignEmail } from "@/lib/email/render";

export async function buildApplicationDecisionEmail({
  decision,
  firstName,
  decisionUrl,
  reimbursementCents,
}: {
  decision: ApplicationDecision;
  firstName: string;
  decisionUrl: string;
  reimbursementCents: number | null;
}) {
  const letter = decisionLetter(decision, reimbursementCents);
  if (!letter || decisionOutcome(decision) !== "accepted") {
    throw new Error("An accepted application decision is required.");
  }

  return renderCampaignEmail({
    templateId: "mhacks-announcement",
    subject: letter.heading,
    previewText: `Congratulations, ${firstName} — your MHacks 2026 decision is ready.`,
    content: {
      eyebrow: `MHacks 2026 · ${letter.roundLabel}`,
      heading: letter.heading,
      intro: `Hi ${firstName},`,
      sections: letter.body.map((body, index) => ({
        id: `decision-${index + 1}`,
        body,
      })),
      cta: {
        label: "View decision & RSVP",
        url: decisionUrl,
      },
      footerNote: [
        letter.footnote,
        letter.signOff,
        "Questions? Reply to this email or contact hackathon@mhacks.org.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  });
}
