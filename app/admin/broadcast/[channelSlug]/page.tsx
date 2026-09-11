import { notFound } from "next/navigation";
import { channelSlugToTargetId } from "@/lib/broadcast/channels";
import { parseBroadcastLogsSearchQuery } from "@/lib/broadcast/log-filter";
import { listBroadcastTargetSummaries } from "@/lib/broadcast/registry";
import "@/lib/broadcast/targets";
import { BroadcastChannelView } from "../BroadcastChannelView";

export default async function BroadcastChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ channelSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { channelSlug } = await params;
  const query = await searchParams;
  const searchQuery = parseBroadcastLogsSearchQuery(query);
  const channelTargetId = channelSlugToTargetId(channelSlug);
  const targets = await listBroadcastTargetSummaries();

  if (
    !channelTargetId ||
    !targets.some((target) => target.id === channelTargetId)
  ) {
    notFound();
  }

  return (
    <BroadcastChannelView
      targets={targets}
      channelTargetId={channelTargetId}
      searchQuery={searchQuery}
    />
  );
}
