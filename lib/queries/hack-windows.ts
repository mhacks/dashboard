import {
  getWindowAvailability,
  type WindowState,
} from "@/lib/reservation/domain";
import { getJudgingSettings } from "@/lib/queries/judging-settings";
import { getSubmissionSettings } from "@/lib/queries/submission-settings";
import { getTeamRegistrationSettings } from "@/lib/queries/team-registration-settings";

export type WindowSnapshot = {
  state: WindowState;
  opensAt: string | null;
  closesAt: string | null;
  /** False when the row could not be read. The window stays closed. */
  available: boolean;
};

export const UNAVAILABLE_WINDOW: WindowSnapshot = {
  state: "closed",
  opensAt: null,
  closesAt: null,
  available: false,
};

export function windowSnapshot(
  row: {
    opensAt: string | null;
    closesAt: string | null;
  } | null,
): WindowSnapshot {
  const opensAt = row?.opensAt ?? null;
  const closesAt = row?.closesAt ?? null;
  return {
    state: getWindowAvailability({ opensAt, closesAt }).state,
    opensAt,
    closesAt,
    available: true,
  };
}

export type HackWindows = {
  registration: WindowSnapshot;
  reservation: WindowSnapshot;
  submission: WindowSnapshot;
};

async function loadSnapshot(
  label: string,
  load: () => Promise<{
    opensAt: string | null;
    closesAt: string | null;
  } | null>,
): Promise<WindowSnapshot> {
  try {
    return windowSnapshot(await load());
  } catch (err) {
    const cause = err instanceof Error ? (err.cause ?? err) : err;
    console.error(`[DB] ${label} window query failed:`, cause);
    return UNAVAILABLE_WINDOW;
  }
}

/** Registration, table reservation, and Devpost windows for the team page. */
export async function getHackWindows(): Promise<HackWindows> {
  const [registration, reservation, submission] = await Promise.all([
    loadSnapshot("team registration", async () => {
      const row = await getTeamRegistrationSettings();
      return row ? { opensAt: row.opensAt, closesAt: row.closesAt } : null;
    }),
    loadSnapshot("table reservation", async () => {
      const row = await getJudgingSettings();
      return row
        ? {
            opensAt: row.reservationsOpenAt,
            closesAt: row.reservationsCloseAt,
          }
        : null;
    }),
    loadSnapshot("devpost submission", async () => {
      const row = await getSubmissionSettings();
      return row ? { opensAt: row.opensAt, closesAt: row.closesAt } : null;
    }),
  ]);

  return { registration, reservation, submission };
}
