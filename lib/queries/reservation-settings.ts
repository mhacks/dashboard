import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { reservationSettings } from "@/lib/db/schema/reservation";

export const RESERVATION_SETTINGS_ID = "default";

/**
 * The single reservation window. A missing row means reservations are closed,
 * matching an unset open time.
 */
export async function getReservationSettings() {
  const [row] = await db
    .select({
      reservationsOpenAt: reservationSettings.reservationsOpenAt,
      reservationsCloseAt: reservationSettings.reservationsCloseAt,
      updatedAt: reservationSettings.updatedAt,
    })
    .from(reservationSettings)
    .where(eq(reservationSettings.id, RESERVATION_SETTINGS_ID))
    .limit(1);

  return row ?? null;
}
