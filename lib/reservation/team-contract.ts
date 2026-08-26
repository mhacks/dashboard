const RESERVATION_TEAM_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

declare const reservationTeamIdBrand: unique symbol;

export type ReservationTeamId = string & {
  readonly [reservationTeamIdBrand]: true;
};

export type ReservationTeamRecord = Readonly<{
  id: string;
  name: string;
}>;

export type ReservationTeam = Readonly<{
  id: ReservationTeamId;
  name: string;
}>;

export type ReservationTeamAdapter = {
  listTeams(): Promise<readonly ReservationTeamRecord[]>;
  getTeamForUser(userId: string): Promise<ReservationTeamRecord | null>;
  getTeamsByIds(
    teamIds: readonly ReservationTeamId[],
  ): Promise<readonly ReservationTeamRecord[]>;
};

export function parseReservationTeamId(
  value: string,
): ReservationTeamId | null {
  if (!RESERVATION_TEAM_ID_PATTERN.test(value)) return null;
  return value.toLowerCase() as ReservationTeamId;
}
