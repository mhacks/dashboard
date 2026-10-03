import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { loadAdminJudgingSnapshot } from "@/lib/actions/judging-admin.actions";
import { JudgingAdmin } from "./judging-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function AdminJudgingPage() {
  const snapshot = await loadAdminJudgingSnapshot();

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Judging controls"
        description="Upload the Devpost CSV, start or stop judging, read rankings, and restore dropped projects."
      />
      <JudgingAdmin initial={snapshot} />
    </AdminPageShell>
  );
}
