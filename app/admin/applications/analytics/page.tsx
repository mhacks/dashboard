import { getApplicationAnalytics } from "@/lib/queries/application-review";
import ApplicationAnalyticsDashboard from "./analytics-dashboard";

export default async function ApplicationAnalyticsPage() {
  const data = await getApplicationAnalytics();

  return <ApplicationAnalyticsDashboard data={data} />;
}
