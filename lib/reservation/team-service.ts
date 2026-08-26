import {
  parseReservationTeamId,
  type ReservationTeam,
  type ReservationTeamAdapter,
  type ReservationTeamId,
  type ReservationTeamRecord,
} from "./team-contract.ts";

export class ReservationTeamContractError extends Error {
  constructor(teamId: string) {
    super(`Team adapter returned an invalid reservation team ID: ${teamId}`);
    this.name = "ReservationTeamContractError";
  }
}

export type ReservationTeamIdResolution =
  | Readonly<{ ok: true; teamId: ReservationTeamId }>
  | Readonly<{ ok: false; reason: "invalid" | "unknown" }>;

export type ReservationTeamService = Readonly<{
  listTeams(): Promise<ReservationTeam[]>;
  getTeamForUser(userId: string): Promise<ReservationTeam | null>;
  getTeamNamesByIds(
    teamIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>>;
  resolveExistingTeamId(teamId: string): Promise<ReservationTeamIdResolution>;
}>;

function requireReservationTeamId(teamId: string): ReservationTeamId {
  const parsed = parseReservationTeamId(teamId);
  if (!parsed) throw new ReservationTeamContractError(teamId);
  return parsed;
}

function validateTeam(team: ReservationTeamRecord): ReservationTeam {
  return {
    id: requireReservationTeamId(team.id),
    name: team.name,
  };
}

function validateTeams(
  teams: readonly ReservationTeamRecord[],
): ReservationTeam[] {
  return teams.map(validateTeam);
}

export function createReservationTeamService(
  adapter: ReservationTeamAdapter,
): ReservationTeamService {
  return {
    async listTeams() {
      const teams = validateTeams(await adapter.listTeams());
      return teams.sort((left, right) => left.name.localeCompare(right.name));
    },

    async getTeamForUser(userId) {
      const team = await adapter.getTeamForUser(userId);
      return team ? validateTeam(team) : null;
    },

    async getTeamNamesByIds(teamIds) {
      const uniqueTeamIds = [...new Set(teamIds.map(requireReservationTeamId))];
      if (uniqueTeamIds.length === 0) return new Map();

      const requestedIds = new Set<string>(uniqueTeamIds);
      const teams = validateTeams(
        await adapter.getTeamsByIds(uniqueTeamIds),
      ).filter((team) => requestedIds.has(team.id));

      return new Map(teams.map((team) => [team.id, team.name]));
    },

    async resolveExistingTeamId(teamId) {
      const parsed = parseReservationTeamId(teamId);
      if (!parsed) return { ok: false, reason: "invalid" };

      const teams = validateTeams(await adapter.getTeamsByIds([parsed]));
      return teams.some((team) => team.id === parsed)
        ? { ok: true, teamId: parsed }
        : { ok: false, reason: "unknown" };
    },
  };
}
