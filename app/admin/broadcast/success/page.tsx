import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "../../components/admin-page-header";
import { AdminPageShell } from "../../components/admin-page-shell";

export default function BroadcastSuccessPage() {
  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Broadcast sent"
        description="Your message has been queued for delivery."
      />
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
