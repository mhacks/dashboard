"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
import {
  BroadcastSyncProvider,
  useBroadcastSync,
} from "./BroadcastSyncProvider";

function broadcastLogsViewKey(targetId: string | null, search: string) {
  return `${targetId ?? "global"}:${search}`;
}

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
  return (
    <BroadcastSyncProvider>
      <BroadcastWorkspaceView
        targets={targets}
        searchQuery={searchQuery}
        initialLogs={initialLogs}
        initialTotalCount={initialTotalCount}
      />
    </BroadcastSyncProvider>
  );
}

function BroadcastWorkspaceView({
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
  const { subscribeBroadcastSync } = useBroadcastSync();
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [logs, setLogs] = useState(initialLogs);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [logsKey, setLogsKey] = useState(
    broadcastLogsViewKey(null, searchQuery),
  );
  const [, startLoadingLogs] = useTransition();
  const logsRequestId = useRef(0);
  const logsRef = useRef(logs);
  const activeTargetIdRef = useRef(activeTargetId);
  const searchQueryRef = useRef(searchQuery);

  useEffect(() => {
    logsRef.current = logs;
    activeTargetIdRef.current = activeTargetId;
    searchQueryRef.current = searchQuery;
  }, [activeTargetId, logs, searchQuery]);

  const channelTarget =
    targets.find((target) => target.id === activeTargetId) ?? null;
  const viewKey = broadcastLogsViewKey(activeTargetId, searchQuery);
  const logsCurrent = logsKey === viewKey;
  const emptyMessage = searchQuery
    ? "No broadcasts match your search."
    : channelTarget
      ? `No broadcasts to ${channelTarget.label} yet. Send the first message below.`
      : "No broadcasts yet. Send the first message below.";
  const targetLabels = Object.fromEntries(
    targets.map((target) => [target.id, target.label]),
  );

  const loadLogs = useCallback(
    (targetId: string | null, search: string) => {
      const requestId = ++logsRequestId.current;
      const key = broadcastLogsViewKey(targetId, search);

      startLoadingLogs(async () => {
        const result = await listBroadcastLogsAction(
          0,
          BROADCAST_LOGS_PAGE_SIZE,
          {
            target: targetId ?? undefined,
            search: search.trim() || undefined,
          },
        );

        if (requestId !== logsRequestId.current) {
          return;
        }

        setLogs(result.items);
        setTotalCount(result.totalCount);
        setLogsKey(key);
      });
    },
    [startLoadingLogs],
  );

  useEffect(() => {
    if (logsKey === viewKey) {
      return;
    }

    loadLogs(activeTargetId, searchQuery);
  }, [activeTargetId, loadLogs, logsKey, searchQuery, viewKey]);

  useEffect(() => {
    return subscribeBroadcastSync((payload) => {
      const targetId = activeTargetIdRef.current;
      if (targetId && payload.target !== targetId) {
        return;
      }

      const known = logsRef.current.some(
        (log) => log.id === payload.broadcastId,
      );
      if (payload.status === "sending" && known) {
        return;
      }

      loadLogs(targetId, searchQueryRef.current);
    });
  }, [loadLogs, subscribeBroadcastSync]);

  function selectChannel(targetId: string | null) {
    if (targetId === activeTargetId) {
      return;
    }

    setActiveTargetId(targetId);
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
          key={viewKey}
          initialLogs={logsCurrent ? logs : []}
          totalCount={logsCurrent ? totalCount : 0}
          channelTargetId={activeTargetId}
          searchQuery={searchQuery}
          targetLabels={targetLabels}
          emptyMessage={emptyMessage}
          isLoading={!logsCurrent}
        />

        <div className="shrink-0 -mx-4 border-t bg-background/95 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/80 md:-mx-6 md:px-6">
          <BroadcastForm
            key={activeTargetId ?? "global"}
            targets={targets}
            channelTargetId={activeTargetId}
            onLogsInvalidated={() => loadLogs(activeTargetId, searchQuery)}
          />
        </div>
      </div>
    </div>
  );
}
