import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ResultsLetter } from "@/components/decision/results-letter";
import { requireSessionUser } from "@/lib/auth/guards";
import { decisionOutcome, isDecided } from "@/lib/decisions";
import { getApplicantDecision } from "@/lib/queries/applicant-decision";
import { isTeamFormationEnabled } from "@/lib/queries/team-settings";
import { getRsvpAccessForUser } from "@/lib/rsvp/access";

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
 */
export default async function DecisionPage() {
  const { id: userId } = await requireSessionUser();

  const application = await getApplicantDecision(userId);
  if (!application || !isDecided(application.decision)) redirect("/dashboard");

  const accepted = decisionOutcome(application.decision) === "accepted";
  const [rsvpAccess, teamsEnabled] = await Promise.all([
    accepted ? getRsvpAccessForUser({ userId }) : Promise.resolve(null),
    isTeamFormationEnabled(),
  ]);
  const rsvpDeadline =
    rsvpAccess?.source === "exception" && rsvpAccess.closesAt
      ? new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/Detroit",
          timeZoneName: "short",
        }).format(new Date(rsvpAccess.closesAt))
      : undefined;

  return (
    <ResultsLetter
      decision={application.decision}
      applicantName={application.firstName}
      reimbursementCents={application.reimbursementCents}
      rsvpDeadline={rsvpDeadline}
      teamsEnabled={teamsEnabled}
    />
  );
}
