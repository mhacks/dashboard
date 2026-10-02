import type { UserRole } from "@/lib/db/schema/users";

export type ParticipantReservationUser = {
  id: string;
  email: string;
  role: UserRole;
  teamId: string | null;
  teamName: string | null;
};

export type TableWithTeam = {
  id: string;
  number: number;
  reservedByTeamId: string | null;
  reservedByTeamName: string | null;
};
