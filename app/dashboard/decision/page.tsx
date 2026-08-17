import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ResultsLetter } from "@/components/decision/results-letter";
import { requireSessionUser } from "@/lib/auth/guards";
import { EVENT } from "@/lib/config/event";
import { isDecided } from "@/lib/decisions";
import { getApplicantDecision } from "@/lib/queries/applicant-decision";

export const metadata: Metadata = {
  title: `Your decision · ${EVENT.fullName}`,
};

/**
 * The decision letter's own route, rather than a modal on the dashboard.
 *
 * A letter is a document: it wants a URL that can be mailed and reloaded and a
 * full page to be read and screenshotted on. The gate mirrors /dashboard/pass —
 * anyone without a released decision goes back to the dashboard rather than
 * seeing an empty page.
 */
export default async function DecisionPage() {
  const { id: userId } = await requireSessionUser();

  const application = await getApplicantDecision(userId);
  if (!application || !isDecided(application.decision)) redirect("/dashboard");

  return (
    <ResultsLetter
      decision={application.decision}
      applicantName={application.firstName}
      reimbursementCents={application.reimbursementCents}
    />
  );
}
