"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EventPicker } from "@/components/reservation/event-picker";
import { JudgingMap } from "@/components/reservation/judging-map";
import { randomlyAssignTable, reserveTable } from "@/lib/actions/reservation";
import type {
  Event,
  SignedInUser,
  TableWithTeam,
} from "@/lib/db/queries/reservation";

export function ReservationBoard({
  events,
  user,
  tables,
  selectedEventId,
}: {
  events: Event[];
  user: SignedInUser | null;
  tables: TableWithTeam[];
  selectedEventId: string;
}) {
  const router = useRouter();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const teamId = user?.teamId ?? null;
  const myTable =
    tables.find((t) => teamId && t.reservedByTeamId === teamId) ?? null;
  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;
  const hasReservation = myTable !== null;
  const canReserve = Boolean(teamId) && !hasReservation;

  const total = tables.length;
  const reservedCount = tables.filter((t) => t.reservedByTeamId).length;
  const openCount = total - reservedCount;

  function handleSelectTable(table: TableWithTeam) {
    if (!canReserve) return;
    setSelectedTableId(table.id);
  }

  function handleReserve() {
    if (!canReserve) {
      toast.error("Your team already has a table for this event.");
      return;
    }
    if (!selectedTable) {
      toast.error("Select a table on the map first.");
      return;
    }
    startTransition(async () => {
      const result = await reserveTable({ tableId: selectedTable.id });
      if (result.ok) {
        toast.success(result.message);
        setSelectedTableId(null);
        router.refresh();
      } else {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  function handleRandom() {
    if (!canReserve) {
      toast.error("Your team already has a table for this event.");
      return;
    }
    startTransition(async () => {
      const result = await randomlyAssignTable({ eventId: selectedEventId });
      if (result.ok) {
        toast.success(result.message);
        setSelectedTableId(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="order-2 lg:order-1">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Judging area</CardTitle>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Badge variant="outline">{openCount} open</Badge>
              <Badge variant="secondary">{reservedCount} reserved</Badge>
            </div>
          </div>
          <CardDescription>
            {hasReservation
              ? "Your table is locked in for this event."
              : "Tap an open table to select it, then reserve."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JudgingMap
            tables={tables}
            selectedTableId={selectedTableId}
            teamId={teamId}
            onSelect={handleSelectTable}
            disabled={isPending || !canReserve}
          />
        </CardContent>
      </Card>

      <div className="order-1 space-y-4 lg:order-2">
        <Card>
          <CardHeader>
            <CardTitle>Reserve your spot</CardTitle>
            {user ? (
              <CardDescription>
                {user.name} · Team{" "}
                <span className="font-medium text-foreground">
                  {user.teamName}
                </span>
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">Event</label>
              <EventPicker events={events} selectedEventId={selectedEventId} />
            </div>

            <Separator />

            {!user ? (
              <div className="rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">
                Signed-in user not found. Run{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                  pnpm db:seed
                </code>
                .
              </div>
            ) : hasReservation ? (
              <div className="rounded-lg border border-[#445721]/30 bg-[#445721]/10 p-3">
                <p className="text-xs text-zinc-500">Your team&apos;s table</p>
                <p
                  className="font-heading text-2xl italic"
                  style={{ color: "#3A4A26" }}
                >
                  Table {myTable.number}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Reservations are final and cannot be changed.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">
                {selectedTable
                  ? `Table ${selectedTable.number} selected — reserve it below.`
                  : "No table reserved yet."}
              </div>
            )}

            {canReserve && (
              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={handleReserve}
                  disabled={isPending || !selectedTable}
                >
                  <Ticket />
                  {selectedTable
                    ? `Reserve table ${selectedTable.number}`
                    : "Select & reserve"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleRandom}
                  disabled={isPending}
                >
                  <Shuffle /> Randomly assign
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
