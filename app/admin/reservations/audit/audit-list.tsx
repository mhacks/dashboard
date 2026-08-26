"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ListPagination } from "@/app/admin/applications/components/list-pagination";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ReservationAuditPage } from "@/lib/queries/admin-reservations";

export type AuditListProps = ReservationAuditPage & {
  basePath: string;
};

const ACTION_LABELS: Record<string, string> = {
  "assignment.assigned": "Team assigned",
  "assignment.displaced": "Team displaced",
  "assignment.moved": "Team moved",
  "assignment.randomly_reserved": "Table randomly reserved",
  "assignment.reserved": "Table reserved",
  "assignment.swapped": "Teams swapped",
  "assignment.unassigned": "Team unassigned",
  "event.archived": "Event archived",
  "event.created": "Event created",
  "event.deleted": "Event deleted",
  "event.restored": "Event restored",
  "event.updated": "Event updated",
  "table.count_changed": "Table count changed",
  "table.created": "Table created",
  "table.deleted": "Table deleted",
  "table.renumbered": "Table renumbered",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function labelFor(value: string): string {
  return value
    .split(/[._]/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? labelFor(action);
}

function formatTimestamp(value: Date | string): string {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? "Unknown time"
    : `${DATE_FORMATTER.format(timestamp)} UTC`;
}

export function AuditList({
  items,
  pageIndex,
  pageSize,
  totalItems,
  basePath,
}: AuditListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function changePage(nextPageIndex: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(nextPageIndex + 1));
    router.push(`${basePath}?${next.toString()}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit activity</CardTitle>
        <CardDescription>
          {totalItems} immutable {totalItems === 1 ? "entry" : "entries"},
          newest first.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No audit activity found.
          </p>
        ) : (
          <div className="flex flex-col">
            {items.map((entry) => (
              <article
                key={entry.id}
                className="flex flex-col gap-3 border-b px-4 py-4 last:border-b-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{actionLabel(entry.action)}</p>
                      <Badge variant="outline">
                        {labelFor(entry.entityType)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {entry.actorEmail} · {entry.eventName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Entity {entry.entityId ?? "snapshot only"}
                    </p>
                  </div>
                  <time
                    dateTime={new Date(entry.createdAt).toISOString()}
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {formatTimestamp(entry.createdAt)}
                  </time>
                </div>

                <Accordion type="single" collapsible>
                  <AccordionItem
                    value={`details-${entry.id}`}
                    className="border-0"
                  >
                    <AccordionTrigger className="py-1.5 text-xs">
                      Structured details
                    </AccordionTrigger>
                    <AccordionContent>
                      <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </article>
            ))}
          </div>
        )}
      </CardContent>
      <ListPagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={changePage}
      />
    </Card>
  );
}
