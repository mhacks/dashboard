"use client";

import { useEffect, useState, useTransition } from "react";
import {
  BROADCAST_LOGS_PAGE_SIZE,
  type BroadcastLogListItem,
} from "@/lib/broadcast/log-types";
import type { BroadcastTargetSummary } from "@/lib/broadcast/types";
import { listBroadcastLogsAction } from "./actions";
import BroadcastForm from "./BroadcastForm";
import { BroadcastChannelNav } from "./BroadcastChannelSidebar";
import { BroadcastLogsSearch } from "./BroadcastLogsSearch";
import { BroadcastMessageFeedPanel } from "./BroadcastMessageFeedPanel";

export function BroadcastWorkspace({
  targets,
  searchQuery,
  initialLogs,
  initialTotalCount,
}: {
  targets: BroadcastTargetSummary[];
  searchQuery: string;
  initialLogs: BroadcastLogListItem[];
  initialTotalCount: number;
}) {
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [channelLogs, setChannelLogs] = useState<BroadcastLogListItem[]>([]);
  const [channelTotalCount, setChannelTotalCount] = useState(0);
  const [, startLoadingChannel] = useTransition();

  const channelTarget = activeTargetId
    ? targets.find((target) => target.id === activeTargetId)
    : null;
  const logs = activeTargetId === null ? initialLogs : channelLogs;
  const totalCount =
    activeTargetId === null ? initialTotalCount : channelTotalCount;
  const emptyMessage = searchQuery
    ? "No broadcasts match your search."
    : channelTarget
      ? `No broadcasts to ${channelTarget.label} yet. Send the first message below.`
      : "No broadcasts yet. Send the first message below.";
  const targetLabels = Object.fromEntries(
    targets.map((target) => [target.id, target.label]),
  );

  useEffect(() => {
    if (activeTargetId === null) {
      return;
    }

    let cancelled = false;
    startLoadingChannel(async () => {
      const result = await listBroadcastLogsAction(
        0,
        BROADCAST_LOGS_PAGE_SIZE,
        {
          target: activeTargetId,
          search: searchQuery.trim() || undefined,
        },
      );

      if (!cancelled) {
        setChannelLogs(result.items);
        setChannelTotalCount(result.totalCount);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeTargetId, searchQuery]);

  function selectChannel(targetId: string | null) {
    if (targetId === activeTargetId) {
      return;
    }

    setActiveTargetId(targetId);
    setChannelLogs([]);
    setChannelTotalCount(0);
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 gap-4">
      <BroadcastChannelNav
        variant="sidebar"
        targets={targets}
        activeTargetId={activeTargetId}
        onSelect={selectChannel}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
        <BroadcastChannelNav
          variant="mobile"
          targets={targets}
          activeTargetId={activeTargetId}
          onSelect={selectChannel}
        />

        <BroadcastLogsSearch
          initialQuery={searchQuery}
          channelLabel={channelTarget?.label ?? "Global"}
        />

        <BroadcastMessageFeedPanel
          key={`${activeTargetId ?? "global"}:${searchQuery}`}
          initialLogs={logs}
          totalCount={totalCount}
          channelTargetId={activeTargetId}
          searchQuery={searchQuery}
          targetLabels={targetLabels}
          emptyMessage={emptyMessage}
        />

        <div className="shrink-0 -mx-4 border-t bg-background/95 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/80 md:-mx-6 md:px-6">
          <BroadcastForm
            key={activeTargetId ?? "global"}
            targets={targets}
            channelTargetId={activeTargetId}
          />
        </div>
      </div>
    </div>
  );
}
