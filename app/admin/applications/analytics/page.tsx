import { getApplicationAnalytics } from "@/lib/actions/application-review.server.actions";
import ApplicationAnalyticsDashboard from "./analytics-dashboard";

export default async function ApplicationAnalyticsPage() {
  const data = await getApplicationAnalytics();

  return <ApplicationAnalyticsDashboard data={data} />;
}
