import { data } from "./applicant-data";
import { ReviewDashboard } from "./components/review-shell";

export default function ReviewPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <ReviewDashboard mails={data} />
    </div>
  );
}
