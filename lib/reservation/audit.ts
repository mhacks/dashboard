import { db } from "@/lib/db";
import { reservationAuditLog } from "@/lib/db/schema/reservation";

type AuditExecutor = Pick<typeof db, "insert">;

export type ReservationAuditInput = Omit<
  typeof reservationAuditLog.$inferInsert,
  "id" | "createdAt"
>;

export async function writeReservationAudit(
  executor: AuditExecutor,
  input: ReservationAuditInput,
) {
  await executor.insert(reservationAuditLog).values(input);
}
