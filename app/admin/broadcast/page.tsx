import { parseBroadcastLogsSearchQuery } from "@/lib/broadcast/log-filter";
import { listBroadcastTargetSummaries } from "@/lib/broadcast/registry";
import { BroadcastChannelView } from "./BroadcastChannelView";

export default async function BroadcastPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const searchQuery = parseBroadcastLogsSearchQuery(params);
  const targets = await listBroadcastTargetSummaries();

  return <BroadcastChannelView targets={targets} searchQuery={searchQuery} />;
}
