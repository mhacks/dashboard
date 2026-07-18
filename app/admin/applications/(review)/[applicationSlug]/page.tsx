import { notFound } from "next/navigation";
import { getApplicationReviewDetail } from "@/lib/actions/application-review.server.actions";
import { getApplicationReviewDashboard } from "@/lib/queries/application-review";
import { applicationSlugSchema } from "@/lib/types/application-reviews";
import ApplicationReviewWorkspace from "../../review-workspace";

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationSlug: string }>;
}) {
  const { applicationSlug } = await params;
  const parsed = applicationSlugSchema.safeParse(applicationSlug);
  if (!parsed.success) notFound();

  const initialData = await getApplicationReviewDashboard();
  const initialSelectedItem = initialData.items.find(
    (item) => item.application.slug === parsed.data,
  );
  if (!initialSelectedItem) notFound();

  let initialSelectedDetail;

  try {
    initialSelectedDetail = await getApplicationReviewDetail(
      initialSelectedItem.application.id,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("not found")
    ) {
      notFound();
    }

    throw error;
  }

  return (
    <ApplicationReviewWorkspace
      initialData={initialData}
      initialSelectedDetail={initialSelectedDetail}
    />
  );
}
