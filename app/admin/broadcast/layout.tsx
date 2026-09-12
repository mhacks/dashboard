import { listBroadcastTargetSummaries } from "@/lib/broadcast/registry";
import { AdminPageHeader } from "../components/admin-page-header";

export default async function BroadcastLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const targets = await listBroadcastTargetSummaries();
  const totalRecipients = targets.reduce(
    (sum, target) => sum + target.recipientCount,
    0,
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background px-4 text-foreground md:px-6">
      <div className="mx-auto w-full max-w-5xl shrink-0 pt-5 lg:max-w-6xl">
        <AdminPageHeader
          title="Broadcast"
          description={`One-way announcements to ${totalRecipients} recipients across ${targets.length} target${targets.length === 1 ? "" : "s"}. Use sparingly.`}
        />
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 pt-4 pb-5 lg:max-w-6xl">
        {children}
      </div>
    </div>
  );
}
