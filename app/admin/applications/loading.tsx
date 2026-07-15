import { ReviewWorkspacePageSkeleton } from "./components/review-workspace-skeletons";

export default function AdminApplicationsLoading() {
  return (
    <main className="h-dvh overflow-hidden bg-background text-foreground">
      <ReviewWorkspacePageSkeleton />
    </main>
  );
}
