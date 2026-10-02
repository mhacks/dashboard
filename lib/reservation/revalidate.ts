import { revalidatePath } from "next/cache";

export function revalidateReservationPaths() {
  for (const path of [
    "/dashboard/team",
    "/admin/reservations",
    "/admin/reservations/tables",
    "/admin/reservations/assignments",
    "/admin/reservations/audit",
    "/admin/reservations/preview",
  ]) {
    revalidatePath(path);
  }
}
