export type TableWithTeam = {
  id: string;
  number: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
  reservedByTeamId: string | null;
  reservedByTeamName: string | null;
};

export type ReservationMapSize = {
  columns: number;
  rows: number;
};
