import { judgingFailure } from "@/lib/judging/errors";
import {
  getJudgingStarted,
  getPool,
  getRankings,
  isMdreddConfigured,
} from "@/lib/judging/mdredd";
import { getSubmittedTeams, teamsByUrl } from "@/lib/judging/teams";
import { DEFAULT_PAIR_SECONDS } from "@/lib/judging/timer";
import { normalizeDevpostUrl } from "@/lib/judging/url";
import { getJudgingSettings } from "@/lib/queries/judging-settings";
import {
  JudgingManagement,
  type JudgingPageState,
  type JudgingProjectRow,
} from "./judging-management";

export const dynamic = "force-dynamic";

export default async function JudgingPage() {
  return <JudgingManagement state={await loadJudging()} />;
}

/** MDredd's projects, each matched to the team that saved its Devpost link. */
async function loadJudging(): Promise<JudgingPageState> {
  if (!isMdreddConfigured()) {
    return {
      kind: "error",
      error:
        "Judging is not set up on this server. Set MDREDD_API_URL and MDREDD_API_TOKEN.",
    };
  }

  try {
    const [started, pool, rankings, submittedTeams, settings] =
      await Promise.all([
        getJudgingStarted(),
        getPool(),
        getRankings(),
        getSubmittedTeams(),
        getJudgingSettings(),
      ]);
    const byUrl = teamsByUrl(submittedTeams);
    const rankOf = new Map(rankings.map((row, index) => [row.id, index + 1]));

    const projects: JudgingProjectRow[] = pool.map((entry) => {
      const url = entry.attributes["Project Url"] ?? "";
      const team = url ? byUrl.get(normalizeDevpostUrl(url)) : undefined;
      return {
        id: entry.id,
        rank: rankOf.get(entry.id) ?? null,
        name: entry.attributes["Project Title"] || `Project ${entry.id}`,
        url,
        teamName: team?.teamName ?? null,
        tableNumber: team?.tableNumber ?? null,
        strikes: entry.strikes,
        removed: entry.removed,
      };
    });

    const projectUrls = new Set(
      projects.filter((p) => p.url).map((p) => normalizeDevpostUrl(p.url)),
    );
    const unmatchedTeams =
      projects.length === 0
        ? []
        : submittedTeams
            .filter(
              (team) => !projectUrls.has(normalizeDevpostUrl(team.devpostUrl)),
            )
            .map((team) => ({
              teamId: team.teamId,
              teamName: team.teamName,
              devpostUrl: team.devpostUrl,
            }));

    return {
      kind: "ready",
      started,
      projects,
      unmatchedTeams,
      pairMinutes: Math.round(
        (settings?.pairSeconds ?? DEFAULT_PAIR_SECONDS) / 60,
      ),
    };
  } catch (error) {
    return {
      kind: "error",
      error: judgingFailure(
        error,
        "Could not load judging from the judging server.",
      ).error,
    };
  }
}
