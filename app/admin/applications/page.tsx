import { getApplicationReviewDetail } from "@/lib/actions/application-review.server.actions";
import { getApplicationReviewDashboard } from "@/lib/queries/application-review";
import ApplicationReviewWorkspace from "./review-workspace";

export default async function AdminApplicationsPage() {
  const initialData = await getApplicationReviewDashboard();
  const initialSelectedItem =
    initialData.items.find((item) => item.application.status === "pending") ??
    initialData.items[0];
  const initialSelectedDetail = initialSelectedItem
    ? await getApplicationReviewDetail(initialSelectedItem.application.id)
    : undefined;

  return (
    <ApplicationReviewWorkspace
      initialData={initialData}
      initialSelectedDetail={initialSelectedDetail}
    />
  );
}
