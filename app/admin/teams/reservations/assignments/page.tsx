import { getAdminReservationAssignments } from "@/lib/queries/admin-reservations";
import { AssignmentManagement } from "./assignment-management";

export const dynamic = "force-dynamic";

export default async function ReservationAssignmentsPage() {
  const data = await getAdminReservationAssignments();
  return <AssignmentManagement {...data} />;
}
