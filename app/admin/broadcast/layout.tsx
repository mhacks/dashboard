import { sumBroadcastRecipientCounts } from "@/lib/broadcast/channels";
import { listBroadcastTargetSummaries } from "@/lib/broadcast/registry";
import "@/lib/broadcast/targets";
import { AdminPageHeader } from "../components/admin-page-header";
import { BroadcastChannelSidebar } from "./BroadcastChannelSidebar";

export default async function BroadcastLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const targets = await listBroadcastTargetSummaries();
  const totalRecipients = sumBroadcastRecipientCounts(targets);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background px-4 text-foreground md:px-6">
      <div className="mx-auto w-full max-w-5xl shrink-0 pt-5 lg:max-w-6xl">
        <AdminPageHeader
          title="Broadcast"
          description={`One-way announcements to ${totalRecipients} recipients across ${targets.length} target${targets.length === 1 ? "" : "s"}. Use sparingly.`}
        />
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 gap-4 pt-4 pb-5 lg:max-w-6xl">
        <BroadcastChannelSidebar targets={targets} />
        {children}
      </div>
    </div>
  );
}
