import { redirect } from "next/navigation";
import { getApplicationAnalytics } from "@/lib/actions/application-review.server.actions";
import { getSessionUser } from "@/lib/auth/session";
import ApplicationAnalyticsDashboard from "./analytics-dashboard";

export default async function ApplicationAnalyticsPage() {
  const user = await getSessionUser();

  if (!user) redirect("/login?next=/admin/applications/analytics");
  if (user.role !== "organizer") redirect("/apply");

  const data = await getApplicationAnalytics();

  return <ApplicationAnalyticsDashboard data={data} />;
}
