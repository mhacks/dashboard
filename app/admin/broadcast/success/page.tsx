import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "../../components/admin-page-header";
import { AdminPageShell } from "../../components/admin-page-shell";

export default async function BroadcastSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; failed?: string }>;
}) {
  const params = await searchParams;
  const sent = Number(params.sent ?? "0");
  const failed = Number(params.failed ?? "0");
  const description =
    failed > 0
      ? `Delivery finished with ${sent} sent and ${failed} failed. Check the logs for details.`
      : `Your message was delivered to ${sent} hackers.`;

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader title="Broadcast sent" description={description} />
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href="/admin/broadcast">Send another</a>
        </Button>
        <Button asChild variant="outline">
          <a href="/admin/broadcast/logs">View logs</a>
        </Button>
      </div>
    </AdminPageShell>
  );
}
