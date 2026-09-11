import { listBroadcastTargetSummaries } from "@/lib/broadcast/registry";
import "@/lib/broadcast/targets";
import { BroadcastChannelView } from "./BroadcastChannelView";

export default async function BroadcastPage({
  searchParams,
}: {
  searchParams: Promise<{ logsPage?: string }>;
}) {
  const params = await searchParams;
  const pageIndex = Math.max(0, Number(params.logsPage ?? "1") - 1);
  const targets = await listBroadcastTargetSummaries();

  return (
    <BroadcastChannelView
      targets={targets}
      channelTargetId={null}
      pageIndex={pageIndex}
    />
  );
}
