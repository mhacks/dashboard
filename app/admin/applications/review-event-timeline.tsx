"use client";

import { useMemo, useState } from "react";
import { HistoryIcon } from "lucide-react";
import type {
  ReviewAuditEventRecord,
  ReviewEventRecord,
} from "@/lib/types/application-reviews";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { paginateSlice } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { ListPagination } from "./components/list-pagination";
import {
  applicationStatusLabel,
  formatReviewEventValue,
} from "./display-formatters";

type TimelineEvent = ReviewEventRecord | ReviewAuditEventRecord;

const REVIEW_EVENT_FIELD_LABELS: Record<string, string> = {
  effortRating: "Effort",
  builderRating: "Builder",
  flaggedForReview: "Flag",
  reviewComments: "Comments",
  reviewedAt: "Reviewed",
};

function isAuditEvent(event: TimelineEvent): event is ReviewAuditEventRecord {
  return "applicationName" in event;
}

function formatEventTimestamp(value: string, compact: true): string;
function formatEventTimestamp(
  value: string,
  compact?: false,
): { date: string; time: string };
function formatEventTimestamp(value: string, compact = false) {
  const date = new Date(value);
  if (compact) {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return {
    date: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    time: date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function eventTypeBadgeClass(eventType: ReviewEventRecord["eventType"]) {
  if (eventType === "review_completed") {
    return "border-green-200 bg-green-50 text-green-700 dark:border-green-900/70 dark:bg-green-950/50 dark:text-green-300";
  }
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
}

function eventTypeLabel(eventType: ReviewEventRecord["eventType"]) {
  if (eventType === "review_completed") return "Completed";
  return "Draft saved";
}

function statusBadgeClass(status: ReviewAuditEventRecord["applicationStatus"]) {
  if (status === "reviewed") {
    return "border-green-200 bg-green-50 text-green-700 dark:border-green-900/70 dark:bg-green-950/50 dark:text-green-300";
  }
  if (status === "flagged") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300";
  }
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
}

function ChangeChip({
  field,
  from,
  to,
  compact = false,
}: {
  field: string;
  from: unknown;
  to: unknown;
  compact?: boolean;
}) {
  const label = REVIEW_EVENT_FIELD_LABELS[field] ?? field;

  if (compact) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-xs leading-5 break-words">
        <span className="text-muted-foreground">{label}</span>
        <span className="mx-1 text-muted-foreground/80">
          {formatReviewEventValue(from, true)}
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="ml-1 font-medium">
          {formatReviewEventValue(to, true)}
        </span>
      </div>
    );
  }

  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-muted-foreground/80">
        {formatReviewEventValue(from)}
      </span>
      <span className="shrink-0 text-muted-foreground">→</span>
      <span className="min-w-0 truncate font-medium">
        {formatReviewEventValue(to)}
      </span>
    </span>
  );
}

function CompactReviewEventRow({ event }: { event: TimelineEvent }) {
  const changes = Object.entries(event.changes);
  const timestamp = formatEventTimestamp(event.createdAt, true);

  return (
    <div className="min-w-0 space-y-2 py-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={eventTypeBadgeClass(event.eventType)}
          >
            {eventTypeLabel(event.eventType)}
          </Badge>
          {isAuditEvent(event) ? (
            <Badge
              variant="outline"
              className={statusBadgeClass(event.applicationStatus)}
            >
              {applicationStatusLabel(event.applicationStatus)}
            </Badge>
          ) : null}
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {timestamp}
        </span>
      </div>

      <p className="truncate text-xs text-muted-foreground">
        {event.reviewerEmail ?? "Unknown organizer"}
        {isAuditEvent(event) ? ` · ${event.applicationName}` : null}
      </p>

      {changes.length > 0 ? (
        <div className="space-y-1.5">
          {changes.map(([field, change]) => (
            <ChangeChip
              key={field}
              field={field}
              from={change.from}
              to={change.to}
              compact
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No field changes</p>
      )}
    </div>
  );
}

export function ReviewEventRow({
  event,
  compact = false,
}: {
  event: TimelineEvent;
  compact?: boolean;
}) {
  if (compact) {
    return <CompactReviewEventRow event={event} />;
  }

  const changes = Object.entries(event.changes);
  const timestamp = formatEventTimestamp(event.createdAt);

  return (
    <div className="relative flex min-w-0 gap-3 px-4 py-3">
      <div className="flex w-28 shrink-0 flex-col pt-0.5">
        <span className="text-xs font-medium text-foreground">
          {typeof timestamp === "string" ? timestamp : timestamp.date}
        </span>
        {typeof timestamp !== "string" ? (
          <span className="text-xs text-muted-foreground">
            {timestamp.time}
          </span>
        ) : null}
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col gap-2 border-l border-border/60 pl-4 before:absolute before:-left-[5px] before:top-2 before:size-2 before:rounded-full before:bg-moss/70 before:ring-2 before:ring-background dark:before:bg-sage/70">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium">
            {event.reviewerEmail ?? "Unknown organizer"}
          </span>
          {isAuditEvent(event) ? (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="min-w-0 truncate text-sm">
                {event.applicationName}
              </span>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={eventTypeBadgeClass(event.eventType)}
          >
            {eventTypeLabel(event.eventType)}
          </Badge>
          {isAuditEvent(event) ? (
            <Badge
              variant="outline"
              className={statusBadgeClass(event.applicationStatus)}
            >
              {applicationStatusLabel(event.applicationStatus)}
            </Badge>
          ) : null}
        </div>

        {changes.length > 0 ? (
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {changes.map(([field, change]) => (
              <ChangeChip
                key={field}
                field={field}
                from={change.from}
                to={change.to}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No field changes</p>
        )}
      </div>
    </div>
  );
}

export function ReviewEventTimeline({
  events,
  loading = false,
  title = "Edit history",
  description,
  emptyMessage = "No review edits logged yet.",
  maxHeight = "480px",
  compact = false,
  pageSize = compact ? 5 : 10,
  className,
}: {
  events: TimelineEvent[];
  loading?: boolean;
  title?: string;
  description?: string;
  emptyMessage?: string;
  maxHeight?: string;
  compact?: boolean;
  pageSize?: number;
  className?: string;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [prevEvents, setPrevEvents] = useState(events);

  if (events !== prevEvents) {
    setPrevEvents(events);
    setPageIndex(0);
  }

  const paginatedEvents = useMemo(
    () => paginateSlice(events, pageIndex, pageSize),
    [events, pageIndex, pageSize],
  );

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-lg border bg-muted/20 p-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <HistoryIcon className="size-4 shrink-0 text-moss dark:text-sage" />
            {title}
          </div>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {loading ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            Loading...
          </span>
        ) : null}
      </div>

      <div className="mt-3 min-w-0">
        {!loading && events.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed bg-background/40 px-3 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <>
            <ScrollArea
              className="w-full min-w-0 overflow-x-hidden"
              style={{ maxHeight }}
            >
              <div className="min-w-0 divide-y divide-border/60 overflow-x-hidden pr-2">
                {paginatedEvents.map((event) => (
                  <ReviewEventRow
                    key={event.id}
                    event={event}
                    compact={compact}
                  />
                ))}
              </div>
            </ScrollArea>
            <ListPagination
              pageIndex={pageIndex}
              totalItems={events.length}
              pageSize={pageSize}
              onPageChange={setPageIndex}
              className="mt-2 rounded-md border-t-0 bg-transparent px-0 py-1.5"
            />
          </>
        )}
      </div>
    </div>
  );
}
