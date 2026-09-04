import { notFound } from "next/navigation";
import { getAdminReservationAssignments } from "@/lib/queries/admin-reservations";
import { AssignmentManagement } from "./assignment-management";

export const dynamic = "force-dynamic";

export default async function ReservationAssignmentsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const data = await getAdminReservationAssignments(eventId);
  if (!data) notFound();

  return <AssignmentManagement {...data} />;
}
