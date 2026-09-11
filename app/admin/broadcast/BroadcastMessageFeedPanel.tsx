"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BroadcastLogListItem } from "@/lib/broadcast/log-types";
import { BROADCAST_LOGS_PAGE_SIZE } from "@/lib/broadcast/log-types";
import { listBroadcastLogsAction } from "./actions";
import { BroadcastMessageFeed } from "./BroadcastMessageFeed";

type BroadcastMessageFeedPanelProps = {
  initialLogs: BroadcastLogListItem[];
  totalCount: number;
  channelTargetId: string | null;
  searchQuery: string;
  targetLabels: Record<string, string>;
  emptyMessage: string;
};

function chronologicalLogs(logs: BroadcastLogListItem[]) {
  return [...logs].reverse();
}

export function BroadcastMessageFeedPanel({
  initialLogs,
  totalCount,
  channelTargetId,
  searchQuery,
  targetLabels,
  emptyMessage,
}: BroadcastMessageFeedPanelProps) {
  const [olderLogs, setOlderLogs] = useState<BroadcastLogListItem[]>([]);
  const [nextPageIndex, setNextPageIndex] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const shouldScrollToBottomRef = useRef(true);
  const nextPageIndexRef = useRef(1);

  const logs = useMemo(() => {
    const recent = chronologicalLogs(initialLogs);
    if (olderLogs.length === 0) {
      return recent;
    }

    const recentIds = new Set(recent.map((log) => log.id));
    const older = olderLogs.filter((log) => !recentIds.has(log.id));
    return [...older, ...recent];
  }, [initialLogs, olderLogs]);

  const hasMore = logs.length < totalCount;
  const hasMoreRef = useRef(hasMore);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    nextPageIndexRef.current = nextPageIndex;
  }, [nextPageIndex]);

  useEffect(() => {
    if (!shouldScrollToBottomRef.current) {
      return;
    }

    const element = scrollRef.current;
    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [initialLogs]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    function handleScroll() {
      const distanceFromBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      shouldScrollToBottomRef.current = distanceFromBottom < 80;
    }

    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root || !hasMore) {
      return;
    }

    async function loadOlder() {
      if (loadingRef.current || !hasMoreRef.current) {
        return;
      }

      loadingRef.current = true;
      setIsLoadingMore(true);
      shouldScrollToBottomRef.current = false;

      const scrollElement = scrollRef.current;
      const previousScrollHeight = scrollElement?.scrollHeight ?? 0;
      const previousScrollTop = scrollElement?.scrollTop ?? 0;
      const pageIndex = nextPageIndexRef.current;

      try {
        const result = await listBroadcastLogsAction(
          pageIndex,
          BROADCAST_LOGS_PAGE_SIZE,
          {
            ...(channelTargetId ? { target: channelTargetId } : {}),
            ...(searchQuery ? { search: searchQuery } : {}),
          },
        );

        const batch = chronologicalLogs(result.items);
        setOlderLogs((previous) => {
          const existingIds = new Set([
            ...previous.map((log) => log.id),
            ...initialLogs.map((log) => log.id),
          ]);
          const newLogs = batch.filter((log) => !existingIds.has(log.id));
          return [...newLogs, ...previous];
        });
        nextPageIndexRef.current = pageIndex + 1;
        setNextPageIndex(pageIndex + 1);
      } finally {
        loadingRef.current = false;
        setIsLoadingMore(false);
        requestAnimationFrame(() => {
          if (!scrollElement) {
            return;
          }

          scrollElement.scrollTop =
            previousScrollTop +
            (scrollElement.scrollHeight - previousScrollHeight);
        });
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }

        void loadOlder();
      },
      { root, threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [channelTargetId, hasMore, initialLogs, searchQuery]);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex min-h-full flex-col justify-end">
        <div className="flex flex-col gap-2 px-1 pb-2">
          <div
            ref={topSentinelRef}
            className="h-px shrink-0"
            aria-hidden="true"
          />
          {isLoadingMore ? (
            <div className="flex justify-center py-2">
              <Loader2
                aria-hidden="true"
                className="size-4 animate-spin text-muted-foreground"
              />
            </div>
          ) : null}
          <BroadcastMessageFeed
            logs={logs}
            targetLabels={targetLabels}
            emptyMessage={emptyMessage}
          />
        </div>
      </div>
    </div>
  );
}
