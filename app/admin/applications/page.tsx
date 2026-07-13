import { getApplicationReviewDashboard } from "@/lib/actions/application-review.server.actions";
import ApplicationReviewWorkspace from "./review-workspace";

export default async function AdminApplicationsPage() {
  const dashboard = await getApplicationReviewDashboard();

  return <ApplicationReviewWorkspace initialData={dashboard} />;
}
