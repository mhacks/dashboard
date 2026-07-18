import { AdminPageHeaderSkeleton } from "./components/admin-page-header-skeleton";
import { AdminPageShell } from "./components/admin-page-shell";

export default function AdminLoading() {
  return (
    <AdminPageShell width="narrow">
      <AdminPageHeaderSkeleton variant="page" withDescription />
    </AdminPageShell>
  );
}
