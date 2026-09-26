import { revalidatePath } from "next/cache";

export function revalidateReservationEventPaths(eventId: string) {
  for (const path of [
    "/reserve",
    "/admin/reservations",
    "/admin/reservations/audit",
    `/admin/reservations/${eventId}`,
    `/admin/reservations/${eventId}/tables`,
    `/admin/reservations/${eventId}/assignments`,
    `/admin/reservations/${eventId}/audit`,
    `/admin/reservations/${eventId}/preview`,
  ]) {
    revalidatePath(path);
  }
}
