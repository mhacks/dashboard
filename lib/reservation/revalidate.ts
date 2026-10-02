import { revalidatePath } from "next/cache";

export function revalidateReservationPaths() {
  for (const path of [
    "/dashboard/team",
    "/admin/teams",
    "/admin/teams/reservations",
    "/admin/teams/reservations/tables",
    "/admin/teams/reservations/assignments",
    "/admin/teams/reservations/audit",
    "/admin/teams/reservations/preview",
  ]) {
    revalidatePath(path);
  }
}
