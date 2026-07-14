"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReviewAuditEventRecord } from "@/lib/types/application-reviews";
import { paginateSlice } from "@/lib/pagination";
import { ListPagination } from "../components/list-pagination";
import { ReviewEventRow } from "../review-event-timeline";

const AUDIT_PAGE_SIZE = 20;

export function AuditActivityFeed({
  events,
}: {
  events: ReviewAuditEventRecord[];
}) {
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [events]);

  const paginatedEvents = useMemo(
    () => paginateSlice(events, pageIndex, AUDIT_PAGE_SIZE),
    [events, pageIndex],
  );

  if (events.length === 0) {
    return (
      <div className="px-4 pb-4">
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
          No review activity yet. Edits will show up here as organizers save
          drafts or complete scorecards.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-h-[480px] overflow-y-auto overscroll-contain">
        <div className="divide-y divide-border/60">
          {paginatedEvents.map((event) => (
            <ReviewEventRow key={event.id} event={event} />
          ))}
        </div>
      </div>
      <ListPagination
        pageIndex={pageIndex}
        totalItems={events.length}
        pageSize={AUDIT_PAGE_SIZE}
        onPageChange={setPageIndex}
      />
    </div>
  );
}
