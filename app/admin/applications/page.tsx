import { requireSessionUser } from "@/lib/auth/guards";
import { getApplicationReviewDashboard } from "@/lib/queries/application-review";
import ApplicationReviewWorkspace from "./review-workspace";

export default async function AdminApplicationsPage() {
  const organizer = await requireSessionUser();
  const initialData = await getApplicationReviewDashboard();

  return (
    <ApplicationReviewWorkspace
      organizer={organizer}
      initialData={initialData}
    />
  );
}
