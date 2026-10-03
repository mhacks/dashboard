import { requireJudgingStaffPage } from "@/lib/auth/guards";
import { getParticipantReservationSnapshot } from "@/lib/db/queries/reservation";
import { presentRow } from "@/lib/judging/display";
import {
  failureFromUnknown,
  getProjects,
  mdreddConfigured,
} from "@/lib/judging/mdredd";
import type { JudgingRow } from "@/lib/judging/types";
import { JudgeConsole } from "./judge-console";

export const dynamic = "force-dynamic";

export default async function JudgePage() {
  const user = await requireJudgingStaffPage();
  const map = await getParticipantReservationSnapshot();
  let projects: JudgingRow[] = [];
  let projectsError: string | null = null;

  if (!mdreddConfigured()) {
    projectsError = "MDREDD_API_TOKEN is not set on the dashboard.";
  } else {
    try {
      projects = (await getProjects()).map(presentRow);
    } catch (error) {
      projectsError = failureFromUnknown(error).error;
    }
  }

  return (
    <JudgeConsole
      canManage={user.role === "organizer"}
      map={{
        columns: map.columns,
        rows: map.rows,
        tables: map.tables,
      }}
      initialProjects={projects}
      projectsError={projectsError}
    />
  );
}
