import { format } from "date-fns";

import {
  ApplicantDashboard,
  type ApplicantStage,
} from "@/components/dashboard/applicant-dashboard";
import { getDraftForUser } from "@/lib/actions/application-form.actions";
import {
  APPLICATION_STEPS,
  completedStepCount,
  isDraftStarted,
} from "@/lib/application-steps";
import { requireSessionUser } from "@/lib/auth/guards";
import { isDecided } from "@/lib/decisions";
import {
  getApplicantDecision,
  type ApplicantDecisionRow,
} from "@/lib/queries/applicant-decision";
import { getAttendeeQrEligibility } from "@/lib/queries/check-in";

/**
 * Stage is derived, never stored. `applied` is the enum's "submitted, no
 * decision yet" value, so in-review is the absence of a decision rather than a
 * state of its own.
 */
function stageFor(application: ApplicantDecisionRow | null): ApplicantStage {
  if (!application) return "applying";
  if (isDecided(application.decision)) return "decision-ready";
  return "in-review";
}

export default async function DashboardPage() {
  const { id: userId, role } = await requireSessionUser();

  // Independent of each other, so they overlap rather than queue.
  const [application, canCheckIn] = await Promise.all([
    getApplicantDecision(userId),
    getAttendeeQrEligibility(userId),
  ]);

  // Only meaningful before submitting — submitting deletes the draft row. Note
  // /apply writes an empty draft on first visit, so progress is measured from
  // the contents rather than the row's existence.
  let draftSteps = 0;
  if (!application) {
    try {
      const draft = await getDraftForUser(userId);
      // 0 means "nothing started". Guarded by isDraftStarted because the
      // field-less Socials step makes even an untouched draft score 1.
      draftSteps =
        draft && isDraftStarted(draft) ? completedStepCount(draft) : 0;
    } catch (err) {
      const cause = err instanceof Error ? (err.cause ?? err) : err;
      console.error("[DB] application draft query failed:", cause);
    }
  }

  return (
    <ApplicantDashboard
      role={role}
      userId={userId}
      canCheckIn={canCheckIn}
      firstName={application?.firstName ?? null}
      data={{
        stage: stageFor(application),
        sectionsComplete: draftSteps,
        sectionsTotal: APPLICATION_STEPS.length,
        submittedAt: application
          ? format(new Date(application.createdAt), "MMMM d, yyyy")
          : undefined,
      }}
    />
  );
}
