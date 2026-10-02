"use client";

import { format } from "date-fns";
import { DownloadIcon, SearchIcon, Undo2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { revokeCheckInAction } from "@/lib/actions/events.server.actions";
import type { EventRoster as EventRosterData } from "@/lib/queries/events";
import { TSHIRT_SIZE_VALUES } from "@/lib/types/rsvps";

export function EventRoster({ roster }: { roster: EventRosterData }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const { event, entries } = roster;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((entry) =>
      [entry.name, entry.email, entry.university ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [entries, query]);

  const allowsRepeats = event.maxCheckins > 1;

  // Shirts handed out so far, in size order. Sizes from before the RSVP
  // normalized them sort after the standard ones rather than disappearing.
  const shirtTally = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const size = entry.shirtSize?.trim().toUpperCase() || "Unknown";
      counts.set(size, (counts.get(size) ?? 0) + 1);
    }
    const order: readonly string[] = TSHIRT_SIZE_VALUES;
    const rank = (size: string) =>
      order.includes(size) ? order.indexOf(size) : order.length;
    return [...counts].sort(([a], [b]) => rank(a) - rank(b));
  }, [entries]);

  function revoke(userId: string, name: string, scanCount: number) {
    startTransition(async () => {
      const result = await revokeCheckInAction({ slug: event.slug, userId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(
        scanCount > 1
          ? `Removed ${name}'s latest scan.`
          : `Removed ${name}'s check-in.`,
      );
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            {entries.length} checked in
            {allowsRepeats ? ` · ${event.scanCount} scans` : ""}
            <Badge variant={event.isActive ? "default" : "secondary"}>
              {event.isActive ? "Open" : "Closed"}
            </Badge>
            <Badge variant="outline">
              {event.requiresRsvp ? "Confirmed RSVPs" : "Any account"}
            </Badge>
            {allowsRepeats ? (
              <Badge variant="outline">
                {event.maxCheckins} scans per person
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            {event.location ? `${event.location} · ` : ""}
            Scanner at <code>/checkin/{event.slug}</code>
          </CardDescription>
          {shirtTally.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              Shirts:
              {shirtTally.map(([size, count]) => (
                <Badge key={size} variant="secondary" className="tabular-nums">
                  {size} · {count}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/checkin/${event.slug}`}>Open scanner</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/admin/events/${event.slug}/export`}>
              <DownloadIcon data-icon="inline-start" />
              Export CSV
            </a>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="relative max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or school"
            className="pl-9"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            {entries.length === 0
              ? "Nobody has been scanned into this event yet."
              : "No one matches that search."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attendee</TableHead>
                  <TableHead>Shirt</TableHead>
                  <TableHead>Checked in</TableHead>
                  {allowsRepeats ? <TableHead>Scans</TableHead> : null}
                  <TableHead>By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => (
                  <TableRow key={entry.userId}>
                    <TableCell>
                      <span className="font-medium">{entry.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {entry.email}
                        {entry.university ? ` · ${entry.university}` : ""}
                      </span>
                    </TableCell>

                    <TableCell className="text-sm">
                      {entry.shirtSize ?? "—"}
                    </TableCell>

                    <TableCell className="text-sm">
                      {format(new Date(entry.checkedInAt), "h:mm a")}
                      <span className="block text-xs text-muted-foreground">
                        {format(new Date(entry.checkedInAt), "EEE d MMM")}
                        {entry.method === "manual" ? " · added by hand" : ""}
                      </span>
                    </TableCell>

                    {allowsRepeats ? (
                      <TableCell className="text-sm tabular-nums">
                        {entry.scanCount} / {event.maxCheckins}
                        {entry.scanCount > 1 ? (
                          <span className="block text-xs text-muted-foreground">
                            Last{" "}
                            {format(new Date(entry.lastScannedAt), "h:mm a")}
                          </span>
                        ) : null}
                      </TableCell>
                    ) : null}

                    <TableCell className="text-sm text-muted-foreground">
                      {entry.checkedInByName ?? "—"}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() =>
                          revoke(entry.userId, entry.name, entry.scanCount)
                        }
                      >
                        <Undo2Icon data-icon="inline-start" />
                        {entry.scanCount > 1 ? "Undo last" : "Undo"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
