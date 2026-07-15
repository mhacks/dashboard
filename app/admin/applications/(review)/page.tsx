import { redirect } from "next/navigation";
import { getApplicationReviewDashboard } from "@/lib/queries/application-review";
import ApplicationReviewWorkspace from "../review-workspace";

export default async function AdminApplicationsPage() {
  const initialData = await getApplicationReviewDashboard();
  const initialSelectedItem =
    initialData.items.find((item) => item.application.status === "pending") ??
    initialData.items[0];

  if (initialSelectedItem) {
    redirect(`/admin/applications/${initialSelectedItem.application.slug}`);
  }

  return (
    <ApplicationReviewWorkspace
      initialData={initialData}
    />
  );
}
