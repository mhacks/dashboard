import { redirect } from "next/navigation";
import { getApplicationReviewDashboard } from "@/lib/actions/application-review.server.actions";
import { getSessionUser } from "@/lib/auth/session";
import ApplicationReviewWorkspace from "./review-workspace";

export default async function AdminApplicationsPage() {
  const user = await getSessionUser();

  if (!user) redirect("/login?next=/admin/applications");
  if (user.role !== "organizer") redirect("/apply");

  const dashboard = await getApplicationReviewDashboard();

  return <ApplicationReviewWorkspace initialData={dashboard} />;
}
