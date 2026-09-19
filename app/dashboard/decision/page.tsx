import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ResultsLetter } from "@/components/decision/results-letter";
import { requireSessionUser } from "@/lib/auth/guards";
import { canViewDecisionLetter } from "@/lib/decisions";
import { getApplicantDecision } from "@/lib/queries/applicant-decision";

export const metadata: Metadata = {
  title: "Your decision · MHacks 2026",
};

/**
 * The decision letter's own route, rather than a modal on the dashboard.
 *
 * A letter is a document: it wants a URL that can be mailed and reloaded and a
 * full page to be read and screenshotted on. The gate mirrors /dashboard/pass —
 * anyone without a released decision goes back to the dashboard rather than
 * seeing an empty page.
 *
 * The same redirect retires the letter after DECISION_LETTER_CLOSE_ISO. Old
 * decision emails link here through /login?next=/dashboard/decision, so the
 * redirect is the graceful landing for a link that outlives the letter.
 */
export default async function DecisionPage() {
  const { id: userId } = await requireSessionUser();

  const application = await getApplicantDecision(userId);
  if (!application || !canViewDecisionLetter(application.decision)) {
    redirect("/dashboard");
  }

  return (
    <ResultsLetter
      decision={application.decision}
      applicantName={application.firstName}
      reimbursementCents={application.reimbursementCents}
    />
  );
}
