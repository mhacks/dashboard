import type { UserRole } from "@/lib/db/schema/users";
import type { ReservationAvailability } from "@/lib/reservation/domain";

export type ParticipantReservationUser = {
  id: string;
  email: string;
  role: UserRole;
  teamId: string | null;
  teamName: string | null;
};

export type ParticipantEvent = {
  id: string;
  name: string;
  description: string | null;
  startsAt: Date | null;
  location: string | null;
  status: "open" | "closed";
  reservationsOpenAt: Date | null;
  reservationsCloseAt: Date | null;
  availability: ReservationAvailability;
};

export type TableWithTeam = {
  id: string;
  number: number;
  reservedByTeamId: string | null;
  reservedByTeamName: string | null;
};
