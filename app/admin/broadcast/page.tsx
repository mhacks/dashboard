import { listBroadcastTargetSummaries } from "@/lib/broadcast/registry";
import "@/lib/broadcast/targets";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPageHeader } from "../components/admin-page-header";
import { AdminPageShell } from "../components/admin-page-shell";
import BroadcastForm from "./BroadcastForm";

export default async function BroadcastPage() {
  const targets = await listBroadcastTargetSummaries();
  const totalRecipients = targets.reduce(
    (sum, target) => sum + target.recipientCount,
    0,
  );

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Broadcast"
        description={`Send a message to ${totalRecipients} recipients across ${targets.length} target${targets.length === 1 ? "" : "s"}. Use sparingly.`}
      />

      <Card>
        <CardContent>
          <BroadcastForm targets={targets} />
        </CardContent>
      </Card>

      <div>
        <Button asChild variant="outline">
          <a href="/admin/broadcast/logs">View logs</a>
        </Button>
      </div>
    </AdminPageShell>
  );
}
