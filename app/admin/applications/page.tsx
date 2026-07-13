import { getApplicationReviewDashboard } from "@/lib/queries/application-review";
import ApplicationReviewWorkspace from "./review-workspace";

export default async function AdminApplicationsPage() {
  const initialData = await getApplicationReviewDashboard();

  return <ApplicationReviewWorkspace initialData={initialData} />;
}
